import { Plugin } from "obsidian";
import { makeReadingViewProcessor } from "./reading-view";

export default class FencedDivsPlugin extends Plugin {
  async onload() {
    this.registerMarkdownPostProcessor(makeReadingViewProcessor());
    console.log("[fenced-divs] loaded");
  }

  onunload() {
    console.log("[fenced-divs] unloaded");
  }
}
