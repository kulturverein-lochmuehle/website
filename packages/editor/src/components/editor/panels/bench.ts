import type { BrushTool, EventTypeKey, Season, Stroke } from '@kvlm/visualization';

import type { EditorLayer, EditorTool } from '../../../scene/editor.scene.js';
import type { Cursor, Working } from '../../viewport/viewport.component.js';
import type { Draft, PanelKey, Picked, Placed, Property, Switch } from '../editor.model.js';

/** The preview baked from the view: baking, shown by its url, or failed with why. */
export type Preview =
  { baking: true; share: number; stage: string } | { src: string } | { error: string };

/** What can be set as it is, without anything else following from it. */
export interface Settings {
  moon: number;
  windows: Switch;
  lanterns: Switch;
  strings: Switch;
  fires: boolean;
  mode: BrushTool;
  radius: number;
  strength: number;
}

/**
 * The editor as its panels see it: what they show, and what they ask it to
 * do. The panels are drawn from it and hold nothing of their own.
 */
export interface Bench extends Readonly<Settings> {
  readonly camera: Readonly<Record<Property, number>>;
  readonly center: readonly [east: number, north: number] | undefined;
  readonly layers: Readonly<Record<EditorLayer, boolean>>;
  readonly season: Season;
  readonly hour: number | undefined;
  readonly decorations: readonly string[];
  readonly tool: EditorTool;
  readonly strokes: readonly Stroke[];
  readonly drags: readonly number[];
  readonly points: readonly Placed[];
  readonly picked: Picked;
  readonly draft: Draft;
  readonly open: Readonly<Record<PanelKey, boolean>>;
  readonly cursor: Cursor | undefined;
  readonly working: Working;
  readonly preview: Preview | undefined;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** What is held for the moment: the view's tool while space is down, the brush's mode while a key is. */
  readonly held: { tool?: EditorTool | undefined; mode?: BrushTool | undefined };
  /** The tool a tool's key kept down goes back to when it is let go. */
  readonly returnsTo: EditorTool | undefined;
  /** Whether the options of the tool in hand are shown. */
  readonly flyoutOpen: boolean;

  set(settings: Partial<Settings>): void;
  sendCar(): void;
  setCamera(property: Property, value: number): void;
  setSky(season: Season, hour: number | undefined): void;
  setEvent(type: EventTypeKey): void;
  goTo(view: string): void;
  setLayer(layer: EditorLayer, visible: boolean, solo: boolean): void;
  setDecoration(tag: string, up: boolean): void;
  setOpen(panel: PanelKey, open: boolean): void;
  setTool(tool: EditorTool): void;
  /** A tool clicked: taken up, or - the one in hand - its options folded open or away. */
  pickTool(tool: EditorTool): void;
  bakePreview(): void;
  copy(text: string): void;
  undo(): void;
  redo(): void;
  frame(): void;
  showShortcuts(): void;
  clearStrokes(): void;
  clearPicks(): void;
  setPoints(points: Placed[]): void;
  setDraft(draft: Partial<Draft>, step: boolean): void;
  loadPlace(key: string): void;
}

/** The value an input was changed to, from its event. */
export const valueOf = (event: Event): string => (event.target as HTMLInputElement).value;
export const checkedOf = (event: Event): boolean => (event.target as HTMLInputElement).checked;
