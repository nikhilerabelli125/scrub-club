import { startEmptyScene } from './render';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('index.html is missing the #scene canvas');
startEmptyScene(canvas);
