import { App, ItemView, MarkdownView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { Compartment, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

interface PluginSettings {
	animationDuration: number;
	showHeader: boolean;
	showScroll: boolean;
	showGraphControls: boolean;
	forceReadable: boolean;
	vignetteOpacity: number;
	vignetteScaleLinear: number;
	vignetteScaleRadial: number;
}

interface HostWindow {
	setFullScreen?: (fullscreen: boolean) => void;
}

interface TypeZenItemView extends ItemView {
	headerEl: HTMLElement;
	editMode?: {
		editor?: {
			cm?: EditorView;
			focus?: () => void;
		};
		editorEl?: HTMLElement;
	};
	dataEngine?: {
		controlsEl?: HTMLElement;
	};
}

interface TypewriterPointerListeners {
	editorEl: HTMLElement;
	onPointerDown: EventListener;
	onKeyDown: EventListener;
}

const DEFAULT_SETTINGS: PluginSettings = {
	animationDuration: 0.25,
	showHeader: false,
	showScroll: false,
	showGraphControls: false,
	forceReadable: true,
	vignetteOpacity: 0.14,
	vignetteScaleLinear: 20,
	vignetteScaleRadial: 45,
};

export default class TypeZen extends Plugin {
	settings: PluginSettings;

	private zenLeaf: WorkspaceLeaf | null = null;
	private escapeHandler: ((event: KeyboardEvent) => void) | null = null;
	private centerRafId = 0;
	private editorObserver: MutationObserver | null = null;
	private typewriterCompartment = new Compartment();
	private typewriterView: EditorView | null = null;
	private typewriterConfigured = new WeakSet<EditorView>();
	private typewriterResizeObserver: ResizeObserver | null = null;
	private typewriterPointerListeners: TypewriterPointerListeners | null = null;
	private cssVariableSnapshot: Map<string, { value: string; priority: string }> | null = null;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: "zenmode",
			name: "Zen mode",
			callback: () => this.toggleZenMode(),
		});
		this.addSettingTab(new TypeZenSettingTab(this.app, this));
	}

	onunload() {
		if (this.isZenActive()) {
			this.exitZen();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.isZenActive()) {
			this.applyZenSettings();
		}
	}

	toggleZenMode() {
		if (this.isZenActive()) {
			this.exitZen();
			return;
		}

		const leaf = this.app.workspace.getActiveViewOfType(ItemView)?.leaf;
		if (!leaf || leaf.view.getViewType() === "empty") return;

		this.enterZen(leaf);
	}

	private isZenActive(): boolean {
		return this.app.workspace.containerEl.classList.contains("typezen-fullscreen");
	}

	private enterZen(leaf: WorkspaceLeaf) {
		this.setMarkdownMode("source");
		this.captureCssVariables();

		const workspaceEl = this.app.workspace.containerEl;
		workspaceEl.classList.add("typezen-fullscreen", "animate");

		this.zenLeaf = leaf;
		this.applyZenSettings();
		this.addStyles(leaf);
		this.setNativeFullscreen(true);
		this.bindEscapeHandler();
		this.waitForEditor(leaf);
	}

	private exitZen() {
		this.cancelEditorSetup();
		this.unbindEscapeHandler();

		const workspaceEl = this.app.workspace.containerEl;
		workspaceEl.classList.remove(
			"typezen-fullscreen",
			"animate",
			"typezen-show-header",
			"typezen-hide-scroll",
		);

		const leaf = this.zenLeaf ?? this.app.workspace.getActiveViewOfType(ItemView)?.leaf;
		if (leaf) {
			this.removeStyles(leaf);
		}

		this.setNativeFullscreen(false);
		this.zenLeaf = null;
		this.restoreCssVariables();

		// Always switch to Reading mode when exiting Zen Mode.
		this.setMarkdownMode("preview");
	}

	private applyCssVariables() {
		const root = document.documentElement;
		root.style.setProperty("--fadeIn-duration", this.settings.animationDuration + "s");
		root.style.setProperty("--vignette-opacity", this.settings.vignetteOpacity.toString());
		root.style.setProperty("--vignette-scale-linear", this.settings.vignetteScaleLinear + "%");
		root.style.setProperty("--vignette-scale-radial", this.settings.vignetteScaleRadial + "%");
	}

	private captureCssVariables() {
		if (this.cssVariableSnapshot) return;

		const style = document.documentElement.style;
		this.cssVariableSnapshot = new Map(
			["--fadeIn-duration", "--vignette-opacity", "--vignette-scale-linear", "--vignette-scale-radial"]
				.map((name) => [
					name,
					{ value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) },
				]),
		);
	}

	private restoreCssVariables() {
		if (!this.cssVariableSnapshot) return;

		const style = document.documentElement.style;
		for (const [name, { value, priority }] of this.cssVariableSnapshot) {
			if (value) {
				style.setProperty(name, value, priority);
			} else {
				style.removeProperty(name);
			}
		}
		this.cssVariableSnapshot = null;
	}

	private applyZenSettings() {
		this.applyCssVariables();

		const workspaceEl = this.app.workspace.containerEl;
		workspaceEl.classList.toggle("typezen-show-header", this.settings.showHeader);
		workspaceEl.classList.toggle("typezen-hide-scroll", !this.settings.showScroll);

		const leaf = this.zenLeaf;
		if (!leaf) return;

		const view = this.getTypeZenView(leaf);
		const isGraph = view.getViewType() === "graph";
		view.headerEl.classList.toggle("hide", !this.settings.showHeader);
		view.headerEl.classList.toggle("animate", this.settings.showHeader);

		if (isGraph) {
			view.dataEngine?.controlsEl?.classList.toggle("hide", !this.settings.showGraphControls);
		} else {
			this.applyReadableLineWidth(view);
		}
	}

	private applyReadableLineWidth(view: TypeZenItemView, forceReadable = this.settings.forceReadable) {
		const vault = this.app.vault as { getConfig?: (key: string) => unknown };
		const readableLineLength = vault.getConfig?.("readableLineLength") === true;
		view.editMode?.editorEl?.classList.toggle(
			"is-readable-line-width",
			forceReadable || readableLineLength,
		);
	}

	private bindEscapeHandler() {
		this.unbindEscapeHandler();
		this.escapeHandler = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				this.exitZen();
			}
		};
		document.addEventListener("keydown", this.escapeHandler);
	}

	private unbindEscapeHandler() {
		if (!this.escapeHandler) return;
		document.removeEventListener("keydown", this.escapeHandler);
		this.escapeHandler = null;
	}

	private setNativeFullscreen(fullscreen: boolean) {
		const win = this.getHostWindow();
		win?.setFullScreen?.(fullscreen);
	}

	private getHostWindow(): HostWindow | null {
		try {
			const workspace = this.app.workspace as { getHostWindow?: () => HostWindow };
			if (typeof workspace.getHostWindow === "function") {
				return workspace.getHostWindow();
			}

			const electron = (window as Window & {
				require?: (moduleName: string) => {
					remote?: { getCurrentWindow?: () => HostWindow };
				};
			}).require?.("electron");

			return electron?.remote?.getCurrentWindow?.() ?? null;
		} catch {
			return null;
		}
	}

	private setMarkdownMode(mode: "source" | "preview") {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView && markdownView.getMode() !== mode) {
			markdownView.setState({ mode }, { history: false });
		}
	}

	private getTypeZenView(leaf: WorkspaceLeaf): TypeZenItemView {
		return leaf.view as TypeZenItemView;
	}

	private getEditorView(leaf: WorkspaceLeaf): EditorView | undefined {
		return this.getTypeZenView(leaf).editMode?.editor?.cm;
	}

	private waitForEditor(leaf: WorkspaceLeaf) {
		this.cancelEditorSetup();
		let initialized = false;

		const initialize = () => {
			if (initialized || !this.isZenActive() || this.zenLeaf !== leaf) return;

			const view = this.getEditorView(leaf);
			if (!view) return;

			initialized = true;
			this.editorObserver?.disconnect();
			this.editorObserver = null;

			view.dispatch({
				selection: { anchor: view.state.doc.length },
				scrollIntoView: false,
			});
			this.getTypeZenView(leaf).editMode?.editor?.focus?.();
			this.applyReadableLineWidth(this.getTypeZenView(leaf));
			this.enableTypewriter(leaf);
			this.centerRafId = requestAnimationFrame(() => {
				this.centerRafId = 0;
				this.centerCaret(leaf);
			});
		};

		initialize();
		if (!initialized && leaf.view.getViewType() === "markdown") {
			this.editorObserver = new MutationObserver(initialize);
			this.editorObserver.observe(this.getTypeZenView(leaf).contentEl, {
				childList: true,
				subtree: true,
			});
		}
	}

	private cancelEditorSetup() {
		this.editorObserver?.disconnect();
		this.editorObserver = null;
		if (this.centerRafId) {
			cancelAnimationFrame(this.centerRafId);
			this.centerRafId = 0;
		}
	}

	private centerCaret(leaf: WorkspaceLeaf, behavior: ScrollBehavior = "auto") {
		try {
			const view = this.getEditorView(leaf);
			if (!view) return;

			const scroller = (view.dom.querySelector(".cm-scroller") as HTMLElement | null) ?? view.dom;
			const pos = view.state.selection.main.head;
			const coords = view.coordsAtPos(pos);
			if (!coords) return;

			const scrollerRect = scroller.getBoundingClientRect();
			const lineHeight = Math.max(1, coords.bottom - coords.top);
			const caretTopInScroller = coords.top - scrollerRect.top + scroller.scrollTop;
			const target = caretTopInScroller - scroller.clientHeight / 2 + lineHeight / 2;

			if (!Number.isFinite(target)) return;
			scroller.scrollTo({ top: target, behavior });
		} catch {
			// Best-effort only; never throw from a scroll helper.
		}
	}

	private enableTypewriter(leaf: WorkspaceLeaf) {
		if (!this.isZenActive()) return;
		const view = this.getEditorView(leaf);
		if (!view || this.typewriterView === view) return;

		this.disableTypewriter();
		this.typewriterView = view;

		const scroller = (view.dom.querySelector(".cm-scroller") as HTMLElement | null) ?? view.dom;
		this.applyTypewriterPadding(view, scroller);

		this.typewriterResizeObserver = new ResizeObserver(() => {
			this.applyTypewriterPadding(view, scroller);
			this.centerCaret(leaf);
		});
		this.typewriterResizeObserver.observe(scroller);

		let waitingForKeyboardInput = false;
		let smoothNextCenter = false;
		const listener = EditorView.updateListener.of((update) => {
			if (!(update.selectionSet || update.docChanged)) return;
			if (update.state.selection.main.from !== update.state.selection.main.to) return;
			if (waitingForKeyboardInput) return;

			this.centerCaret(leaf, smoothNextCenter ? "smooth" : "auto");
			smoothNextCenter = false;
		});

		try {
			if (this.typewriterConfigured.has(view)) {
				view.dispatch({
					effects: this.typewriterCompartment.reconfigure(listener),
				});
			} else {
				view.dispatch({
					effects: StateEffect.appendConfig.of(this.typewriterCompartment.of(listener)),
				});
				this.typewriterConfigured.add(view);
			}
		} catch {
			this.typewriterView = null;
			this.typewriterResizeObserver?.disconnect();
			this.typewriterResizeObserver = null;
			return;
		}

		const onPointerDown: EventListener = () => {
			waitingForKeyboardInput = true;
			smoothNextCenter = false;
		};
		const onKeyDown: EventListener = (event) => {
			const key = (event as KeyboardEvent).key;
			if (["Shift", "Control", "Alt", "Meta"].includes(key)) return;
			if (!waitingForKeyboardInput) return;

			waitingForKeyboardInput = false;
			smoothNextCenter = true;
		};
		view.dom.addEventListener("pointerdown", onPointerDown, true);
		view.dom.addEventListener("keydown", onKeyDown, true);
		this.typewriterPointerListeners = { editorEl: view.dom, onPointerDown, onKeyDown };

		this.centerCaret(leaf);
	}

	private applyTypewriterPadding(view: EditorView, scroller: HTMLElement) {
		const lineHeight = parseFloat(getComputedStyle(view.dom).lineHeight) || 20;
		scroller.style.paddingTop = `${Math.max(0, scroller.clientHeight / 2 - lineHeight / 2)}px`;
	}

	private disableTypewriter() {
		this.typewriterResizeObserver?.disconnect();
		this.typewriterResizeObserver = null;
		this.removeTypewriterPointerListeners();

		const view = this.typewriterView;
		this.typewriterView = null;
		if (!view) return;

		try {
			view.dispatch({
				effects: this.typewriterCompartment.reconfigure([]),
			});
		} catch {
			// Editor may already be torn down.
		}

		const scroller = (view.dom.querySelector(".cm-scroller") as HTMLElement | null) ?? view.dom;
		scroller.style.paddingTop = "";
	}

	private removeTypewriterPointerListeners() {
		const listeners = this.typewriterPointerListeners;
		if (!listeners) return;

		listeners.editorEl.removeEventListener("pointerdown", listeners.onPointerDown, true);
		listeners.editorEl.removeEventListener("keydown", listeners.onKeyDown, true);
		this.typewriterPointerListeners = null;
	}

	private addStyles(leaf: WorkspaceLeaf) {
		const view = this.getTypeZenView(leaf);
		const viewEl = view.contentEl;
		const isGraph = view.getViewType() === "graph";

		viewEl.classList.add(isGraph ? "vignette-radial" : "vignette-linear", "animate");

		if (!isGraph) {
			this.applyReadableLineWidth(view);
		}

		this.enableTypewriter(leaf);
	}

	private removeStyles(leaf: WorkspaceLeaf) {
		const view = this.getTypeZenView(leaf);
		const viewEl = view.contentEl;
		const header = view.headerEl;
		const isGraph = view.getViewType() === "graph";

		if (isGraph) {
			view.dataEngine?.controlsEl?.classList.remove("animate", "hide");
		} else {
			this.applyReadableLineWidth(view, false);
		}

		viewEl.classList.remove("vignette-linear", "vignette-radial", "animate");
		header.classList.remove("animate", "hide");

		this.disableTypewriter();
	}
}

class TypeZenSettingTab extends PluginSettingTab {
	plugin: TypeZen;

	constructor(app: App, plugin: TypeZen) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h3", { text: "Vignette" });
		this.addSliderSetting(
			containerEl,
			"Opacity",
			"Intensity of vignette's dimming effect. Set to 0 to turn vignetting off.",
			{ min: 0, max: 1, step: 0.01 },
			"vignetteOpacity",
		);
		this.addSliderSetting(
			containerEl,
			"Scale in text views",
			"Determines how close to the screen's center vignetting spreads from both sides of the screen, as linear gradients.",
			{ min: 5, max: 50, step: 5 },
			"vignetteScaleLinear",
		);
		this.addSliderSetting(
			containerEl,
			"Scale in graph view",
			"Determines how close to the screen's center vignetting spreads from borders of the screen, as a radial gradient.",
			{ min: 5, max: 100, step: 5 },
			"vignetteScaleRadial",
		);

		containerEl.createEl("h3", { text: "Animation" });
		new Setting(containerEl)
			.setName("Fade-in duration")
			.setDesc("The duration (in seconds) of fade-in animation on entering Zen mode")
			.addText((text) =>
				text
					.setPlaceholder("0.25")
					.setValue(String(this.plugin.settings.animationDuration))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (!Number.isFinite(parsed) || parsed < 0) return;
						this.plugin.settings.animationDuration = parsed;
						await this.plugin.saveSettings();
					}),
			);

		containerEl.createEl("h3", { text: "Element Toggles" });
		this.addToggleSetting(
			containerEl,
			"Show header",
			"Show the tab's header in Zen mode",
			"showHeader",
		);
		this.addToggleSetting(
			containerEl,
			"Show scrollbar",
			"Show the scrollbar in Zen mode. If it is hidden, scrolling is still available with mousewheel, arrows, touchpad, etc.",
			"showScroll",
		);
		this.addToggleSetting(
			containerEl,
			"Show graph controls",
			"Show the graph view's controls in Zen mode",
			"showGraphControls",
		);

		containerEl.createEl("h3", { text: "Misc" });
		this.addToggleSetting(
			containerEl,
			"Force content centering",
			"Center text content in Zen mode, even if in regular view it takes all of the screen's width (ignore 'Editor -> Readable line length' being off in Zen mode)",
			"forceReadable",
		);
	}

	private addSliderSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		limits: { min: number; max: number; step: number },
		key: "vignetteOpacity" | "vignetteScaleLinear" | "vignetteScaleRadial",
	) {
		let valueEl: HTMLDivElement;
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSlider((slider) =>
				slider
					.setLimits(limits.min, limits.max, limits.step)
					.setValue(this.plugin.settings[key])
					.onChange(async (value) => {
						valueEl.innerText = " " + value.toString();
						this.plugin.settings[key] = value;
						await this.plugin.saveSettings();
					}),
			)
			.settingEl.createDiv("", (el: HTMLDivElement) => {
				valueEl = el;
				el.style.minWidth = "2.0em";
				el.style.textAlign = "right";
				el.innerText = " " + this.plugin.settings[key].toString();
			});
	}

	private addToggleSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		key: "showHeader" | "showScroll" | "showGraphControls" | "forceReadable",
	) {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
					this.plugin.settings[key] = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
