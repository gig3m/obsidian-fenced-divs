import { Plugin } from "obsidian";

export default class FencedDivsPlugin extends Plugin {
  async onload() {
    console.log("[fenced-divs] loaded");
  }

  onunload() {
    console.log("[fenced-divs] unloaded");
  }
}
