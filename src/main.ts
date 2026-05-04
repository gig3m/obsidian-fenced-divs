import { Plugin } from "obsidian";
import { makeReadingViewProcessor } from "./reading-view";
import { makeLivePreviewExtension } from "./live-preview";

export default class FencedDivsPlugin extends Plugin {
  async onload() {
    this.registerMarkdownPostProcessor(makeReadingViewProcessor());
    this.registerEditorExtension(
      makeLivePreviewExtension({
        app: this.app,
        component: this,
        getSourcePath: () => this.app.workspace.getActiveFile()?.path ?? "",
      }),
    );
    console.log("[fenced-divs] loaded");
  }

  onunload() {
    console.log("[fenced-divs] unloaded");
  }
}
