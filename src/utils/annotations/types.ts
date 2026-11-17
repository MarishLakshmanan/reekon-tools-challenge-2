/** Position in image pixels (not screen pixels). */
export type Point = { x: number; y: number };

export type Anchor = {
  id: string;
  point: Point;
};

export type PenPath = {
  id: string;
  kind: "path";
  anchors: Anchor[];
  closed: boolean;
  stroke: string;
  strokeWidth: number;
};

export type MeasurementUnit = "mm" | "cm" | "m" | "in" | "ft";

/** One segment of a path: two adjacent anchors. */
export type Segment = { pathId: string; startAnchorId: string; endAnchorId: string };

/** Not on any segment: kept in the list and saved, but not drawn on the photo. */
export type Unassigned = { pathId: null; startAnchorId: null; endAnchorId: null };

/** A length for one segment of a path, or unassigned when its segment was deleted or it was never linked. */
export type Measurement = (Segment | Unassigned) & {
  id: string;
  kind: "measurement";
  /** The photo has no real-world scale, so this is never computed. */
  value: number;
  unit: MeasurementUnit;
  /** Distance of the label from the segment, in image pixels. */
  labelOffset: number;
  color: string;
};

export type TextLabel = {
  id: string;
  kind: "text";
  position: Point;
  text: string;
  fontSize: number;
  color: string;
};

export type Annotation = PenPath | Measurement | TextLabel;

export type AnnotationDoc = {
  id: string;
  projectId: string;
  /** `uri` is the local file when there is one, otherwise the server URL. */
  image: { uri: string; width: number; height: number };
  /** Array order is draw order. */
  annotations: Annotation[];
  createdAt: number;
  updatedAt: number;
  /** Server `version` at the last successful Save or download; `null` until first uploaded. */
  serverVersion: number | null;
  /** `updatedAt` at the last successful Save or download. Unsaved changes when it differs. */
  savedAt: number | null;
};
