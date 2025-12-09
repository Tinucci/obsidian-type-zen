import { App, ItemView, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from "obsidian";
import { EditorView } from "@codemirror/view";

interface PluginSettings {
	animationDuration: number,
	showHeader: boolean,
	showScroll: boolean,
	showGraphControls: boolean,
	forceReadable: boolean,
	vignetteOpacity: number,
	vignetteScaleLinear: number,
	vignetteScaleRadial: number
}

const DEFAULT_SETTINGS: PluginSettings = {
	animationDuration: 2,
	showHeader: false,
	showScroll: false,
	showGraphControls: false,
	forceReadable: true, 
	vignetteOpacity: 0.75,
	vignetteScaleLinear: 20,
	vignetteScaleRadial: 75
}

export default class TypeZen extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addCommand({
			id: "zenmode",
			name: "Zen mode",
			callback: this.fullscreenMode.bind(this),
		});
		this.addSettingTab(new TypeZenSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	fullscreenMode() {
		// Get the active leaf
		const leaf = this.app.workspace.getActiveViewOfType(ItemView)?.leaf;
		if (!leaf || leaf.view.getViewType() === "empty") return;

		// Update root CSS variables for vignette and animation
		const root = document.documentElement;
		root.style.setProperty('--fadeIn-duration', this.settings.animationDuration + 's');
		root.style.setProperty('--vignette-opacity', this.settings.vignetteOpacity.toString());
		root.style.setProperty('--vignette-scale-linear', this.settings.vignetteScaleLinear + '%');
		root.style.setProperty('--vignette-scale-radial', this.settings.vignetteScaleRadial + '%');

		const workspaceEl = this.app.workspace.containerEl;
		const isActive = workspaceEl.classList.contains('typezen-fullscreen');

		// Get Electron window safely
		let win: any = null;
		try {
			win = (this.app as any).workspace.getHostWindow?.() || (window as any).require?.('electron')?.remote?.getCurrentWindow?.();
		} catch (e) {
			win = null;
		}

		if (!isActive) {
			// Enter simulated fullscreen
			workspaceEl.classList.add('typezen-fullscreen');
			this.addStyles(leaf);

			// Enter native fullscreen if window object available
			if (win?.setFullScreen) win.setFullScreen(true);

			// Add animation class to workspace for fade-in
			workspaceEl.classList.add('animate');

			// Escape key listener to exit
			const escapeHandler = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					workspaceEl.classList.remove('typezen-fullscreen');
					workspaceEl.classList.remove('animate');
					this.removeStyles(leaf);
					if (win?.setFullScreen) win.setFullScreen(false);
					document.removeEventListener('keydown', escapeHandler);
				}
			};
			document.addEventListener('keydown', escapeHandler);

			const editor = leaf.view.editMode.editor;
			if (editor) editor.focus();

			const view: EditorView = (editor as any).cm;
			if (!view) return;

			view.dispatch({
				selection: { anchor: view.state.doc.length},
				scrollIntoView: false
			});

			// TODO(): Urgently change this with something better.
			// Although it seems like at whatever point the function is called, it is still early
			let attempts = 0;
			const maxAttempts = 100;

			const centerLoop = () => {
				this.centerCaret(leaf);
				attempts++;
				// If not at desired scroll or still within max attempts, try next frame
				if (attempts < maxAttempts) requestAnimationFrame(centerLoop);
			};

			requestAnimationFrame(centerLoop);

		} else {
			// Exit fullscreen
			workspaceEl.classList.remove('typezen-fullscreen');
			workspaceEl.classList.remove('animate');
			this.removeStyles(leaf);
			if (win?.setFullScreen) win.setFullScreen(false);
		}
	}

	private applyNoScroll(leaf: WorkspaceLeaf) {
		const viewEl = leaf.view.contentEl;
		const scroller = viewEl.querySelector('.cm-scroller') as HTMLElement;
		if (!scroller) return;

		// Avoid double-wrapping
		if (scroller.parentElement?.classList.contains('cm-scroller-wrapper')) return;

		const wrapper = document.createElement('div');
		wrapper.classList.add('cm-scroller-wrapper');

		scroller.parentElement?.insertBefore(wrapper, scroller);
		wrapper.appendChild(scroller);

		scroller.classList.add('noscroll-native');

		const wheelHandler = (ev: WheelEvent) => {
			scroller.scrollTop += ev.deltaY;
			scroller.scrollLeft += ev.deltaX;
			ev.preventDefault();
		};

		wrapper.addEventListener('wheel', wheelHandler, { passive: false });

		(scroller as any)._wrapper = wrapper;
		(scroller as any)._wheelHandler = wheelHandler;
	}

	private removeNoScroll(leaf: WorkspaceLeaf) {
		const viewEl = leaf.view.contentEl;
		const scroller = viewEl.querySelector('.cm-scroller') as HTMLElement;
		if (!scroller) return;

		const wrapper = (scroller as any)._wrapper as HTMLElement | undefined;
		const wheelHandler = (scroller as any)._wheelHandler as EventListener | undefined;

		if (wrapper && wheelHandler) {
			wrapper.removeEventListener('wheel', wheelHandler);
			wrapper.parentElement?.insertBefore(scroller, wrapper);
			wrapper.remove();
		}

		scroller.classList.remove('noscroll-native');

		delete (scroller as any)._wrapper;
		delete (scroller as any)._wheelHandler;
	}

	// Helper: center caret vertically in scroller
	private centerCaret(leaf: WorkspaceLeaf) {
		try {
			const cmWrapper = (leaf.view as any).editMode?.editor;
			const view: EditorView | undefined = cmWrapper?.cm;
			if (!view) return;

			const scroller: HTMLElement = (view.dom.querySelector('.cm-scroller') as HTMLElement) || (view.dom as HTMLElement);

			// current caret position (doc offset)
			const pos = view.state.selection.main.head;
			// Get coordinates for that position (relative to viewport)
			const coords = view.coordsAtPos(pos);
			if (!coords) return;

			const scrollerRect = scroller.getBoundingClientRect();

			// Height of caret line (use coords.bottom - coords.top as best estimate)
			const lineHeight = Math.max(1, coords.bottom - coords.top);

			// Compute absolute offset to target scroll top so that caret's center is at scroller center
			const caretTopInScroller = coords.top - scrollerRect.top + scroller.scrollTop;
			const target = caretTopInScroller - (scroller.clientHeight / 2) + (lineHeight / 2);

			// Avoid NaN or small differences being forced repeatedly
			if (!Number.isFinite(target)) return;

			// Apply without smooth behavior to avoid visual jump issues
			scroller.scrollTo({ top: target, behavior: 'auto' });
		} catch (e) {
			// Best-effort only. Silence any unexpected runtime errors.
			// (Do not throw — we must remain non-destructive to existing behavior.)
		}
	};

	private enableTypewriter(leaf: WorkspaceLeaf) {
		// Defensive lookups for current editor/view
		const cmWrapper = (leaf.view as any).editMode?.editor;
		const view: EditorView | undefined = cmWrapper?.cm;
		if (!view) return;

		// Avoid double registration
		if ((view as any)._typewriterActive) return;
		(view as any)._typewriterActive = true;

		// Find the visible scroller element (fallback to view.dom)
		const scroller: HTMLElement = (view.dom.querySelector('.cm-scroller') as HTMLElement) || (view.dom as HTMLElement);

		const lineHeight = parseFloat(getComputedStyle(view.dom).lineHeight) || 20; 
		if (!scroller.classList.contains('typewriter-top-padding')) {
			scroller.style.paddingTop = `${scroller.clientHeight / 2 - lineHeight / 2}px`;
			scroller.classList.add('typewriter-top-padding');
		}

		// Events that reasonably indicate selection/caret changes
		const events = ['keydown', 'mouseup', 'pointerup', 'input'];

		// Bind handlers
		const bound = (ev: Event) => {
			// For keyboard, we care about navigation keys too (arrows, page up/down)
			// but key detection is not necessary: center on any keyup/input
			this.centerCaret(leaf);
		};

		for (const evName of events) view.dom.addEventListener(evName, bound, { passive: true });

		// Also do an initial centering right away
		this.centerCaret(leaf);

		// Store cleanup handles on view so disable is simple
		(view as any)._typewriterCleanup = () => {
			for (const evName of events) view.dom.removeEventListener(evName, bound);

			// --- Remove top padding ---
			scroller.style.paddingTop = '';
			scroller.classList.remove('typewriter-top-padding');

			delete (view as any)._typewriterCleanup;
			delete (view as any)._typewriterActive;
		};
	}

	private disableTypewriter(leaf: WorkspaceLeaf) {
		const cmWrapper = (leaf.view as any).editMode?.editor;
		const view: EditorView | undefined = cmWrapper?.cm;
		if (!view) return;

		const cleanup = (view as any)._typewriterCleanup as (() => void) | undefined;
		if (typeof cleanup === 'function') {
			try { cleanup(); } catch (e) { /* ignore */ }
		}
	}

	addStyles(leaf: WorkspaceLeaf) {
		const viewEl = leaf.view.contentEl
		const header = leaf.view.headerEl
		const isGraph = leaf.view.getViewType() === "graph"

		let graphControls: HTMLElement;
		if (isGraph) { graphControls = leaf.view.dataEngine.controlsEl}
		if (!this.settings.showScroll) {
			this.applyNoScroll(leaf);
		}
		if (isGraph && !this.settings.showGraphControls) { graphControls.classList.add("hide") }
		isGraph ? viewEl.classList.add("vignette-radial") : viewEl.classList.add("vignette-linear")
		if (!isGraph && this.settings.forceReadable) { leaf.view.editMode.editorEl.classList.add("is-readable-line-width") }

		this.enableTypewriter(leaf);

		viewEl.classList.add("animate")
		this.settings.showHeader ? header.classList.add("animate") : header.classList.add("hide")
	}

	removeStyles(leaf: WorkspaceLeaf) {
		const viewEl = leaf.view.contentEl
		const header = leaf.view.headerEl
		const isGraph = leaf.view.getViewType() === "graph"

		let graphControls: HTMLElement;
		if (isGraph) {
			graphControls = leaf.view.dataEngine.controlsEl
			graphControls.classList.remove("animate", "hide")
		} else if (!this.app.vault.getConfig('readableLineLength')) {
			leaf.view.editMode.editorEl.classList.remove("is-readable-line-width")
		}

		viewEl.classList.remove("vignette-linear", "vignette-radial", "animate")
		header.classList.remove("animate", "hide")

		this.removeNoScroll(leaf);

		this.disableTypewriter(leaf);
	}
}

class TypeZenSettingTab extends PluginSettingTab {
	plugin: TypeZen;

	constructor(app: App, plugin: TypeZen) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		this.containerEl.createEl("h3", {
			text: "Vignette",
		})

// VIGNETTE OPACITY SETTING
		let vignetteOpacityNumber: HTMLDivElement;
		new Setting(containerEl)
			.setName('Opacity')
			.setDesc("Intensity of vignette's dimming effect. Set to 0 to turn vignetting off.")
			.addSlider((slider) => slider
				.setLimits(0.00,1,0.01)
				.setValue(this.plugin.settings.vignetteOpacity)
				.onChange(async (value) => {
					vignetteOpacityNumber.innerText = " " + value.toString();
					this.plugin.settings.vignetteOpacity = value;
					await this.plugin.saveSettings();
				}))
				.settingEl.createDiv("", (el: HTMLDivElement) => {
					vignetteOpacityNumber = el;
					el.style.minWidth = "2.0em";
					el.style.textAlign = "right";
					el.innerText = " " + this.plugin.settings.vignetteOpacity.toString();
				});

// VIGNETTE SCALE LINEAR SETTING
		let vignetteScaleLinearNumber: HTMLDivElement;
		new Setting(containerEl)
			.setName('Scale in text views')
			.setDesc("Determines how close to the screen's center vignetting spreads from both sides of the screen, as linear gradients.")
			.addSlider((slider) => slider
				.setLimits(5,50,5)
				.setValue(this.plugin.settings.vignetteScaleLinear)
				.onChange(async (value) => {
					vignetteScaleLinearNumber.innerText = " " + value.toString();
					this.plugin.settings.vignetteScaleLinear = value;
					await this.plugin.saveSettings();
				}))
				.settingEl.createDiv("", (el: HTMLDivElement) => {
					vignetteScaleLinearNumber = el;
					el.style.minWidth = "2.0em";
					el.style.textAlign = "right";
					el.innerText = " " + this.plugin.settings.vignetteScaleLinear.toString();
				});
// VIGNETTE SCALE RADIAL SETTING
		let vignetteScaleRadialNumber: HTMLDivElement;
		new Setting(containerEl)
			.setName('Scale in graph view')
			.setDesc("Determines how close to the screen's center vignetting spreads from borders of the screen, as a radial gradient.")
			.addSlider((slider) => slider
				.setLimits(5,100,5)
				.setValue(this.plugin.settings.vignetteScaleRadial)
				.onChange(async (value) => {
					vignetteScaleRadialNumber.innerText = " " + value.toString();
					this.plugin.settings.vignetteScaleRadial = value;
					await this.plugin.saveSettings();
				}))
				.settingEl.createDiv("", (el: HTMLDivElement) => {
					vignetteScaleRadialNumber = el;
					el.style.minWidth = "2.0em";
					el.style.textAlign = "right";
					el.innerText = " " + this.plugin.settings.vignetteScaleRadial.toString();
				});

		this.containerEl.createEl("h3", {
			text: "Animation",
		})
// CONTENT FADE-IN DURATION SETTING
		new Setting(containerEl)
			.setName('Fade-in duration')
			.setDesc('The duration (in seconds) of fade-in animation on entering Zen mode')
			.addText(text => text
				.setPlaceholder('1.2')
				.setValue(String(this.plugin.settings.animationDuration))
				.onChange(async (value) => {
					this.plugin.settings.animationDuration = Number(value)
					await this.plugin.saveSettings();
				}));

		this.containerEl.createEl("h3", {
			text: "Element Toggles",
		})

// SHOW HEADER TOGGLE SETTING
		new Setting(containerEl)
			.setName("Show header")
			.setDesc("Show the tab's header in Zen mode")
			.addToggle((toggle) =>	toggle
				.setValue(this.plugin.settings.showHeader)
				.onChange(async (value) => {
					this.plugin.settings.showHeader = value;
					await this.plugin.saveSettings();
			})
		);
// SHOW SCROLLBAR TOGGLE SETTING
		new Setting(containerEl)
			.setName("Show scrollbar")
			.setDesc("Show the scrollbar in Zen mode. If it is hidden, scrolling is still available with mousewheel, arrows, touchpad, etc.")
			.addToggle((toggle) =>	toggle
				.setValue(this.plugin.settings.showScroll)
				.onChange(async (value) => {
					this.plugin.settings.showScroll = value;
					await this.plugin.saveSettings();
			})
		);
// SHOW GRAPH CONTROLS SETTING
		new Setting(containerEl)
			.setName("Show graph controls")
			.setDesc("Show the graph view's controls in Zen mode")
			.addToggle((toggle) =>	toggle
				.setValue(this.plugin.settings.showGraphControls)
				.onChange(async (value) => {
					this.plugin.settings.showGraphControls = value;
					await this.plugin.saveSettings();
			})
		);

		this.containerEl.createEl("h3", {
			text: "Misc",
		})

// FORCE READABLE SETTING
		new Setting(containerEl)
			.setName("Force content centering")
			.setDesc("Center text content in Zen mode, even if in regular view it takes all of the screen's width (ignore 'Editor -> Readable line length' being off in Zen mode)")
			.addToggle((toggle) =>	toggle
				.setValue(this.plugin.settings.forceReadable)
				.onChange(async (value) => {
					this.plugin.settings.forceReadable = value;
					await this.plugin.saveSettings();
			})
		);
	}

}
