
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ObjectPart {
  id: string;
  name: string;
  explanation: string;
  box_2d: number[]; // [ymin, xmin, ymax, xmax] 0-1000 scale
}

export interface AnalysisResult {
  mainObject: string;
  summary: string;
  parts: ObjectPart[];
}

export enum AppState {
  IDLE = 'IDLE',
  CAMERA = 'CAMERA',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}
