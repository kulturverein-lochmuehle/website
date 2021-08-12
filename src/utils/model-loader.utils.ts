import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { LoadingManager } from 'three';
import { Collada, ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader';

export type ModelLoader<T> = new (manager?: LoadingManager) => {
  load: (
    url: string,
    onLoad: (result: T) => void,
    onProgress?: (xhr: { loaded: number; total: number; }) => void,
    onError?: (error: ErrorEvent) => void,
  ) => void;
}

/**
 * loads models with a given loader
 */
export const loadModel = async <T>(url: string, loader: ModelLoader<T>): Promise<T> => new Promise((resolve, reject) => {
  new loader().load(
    url,
    result => resolve(result),
    ({ loaded, total }) => console.info(`${loaded / total * 100}%`),
    error => reject(error));
});

/**
 * loads glTF models
 * @see https://en.wikipedia.org/wiki/GlTF
 */
export const loadGltf = async (url: string): Promise<GLTF> => await loadModel(url, GLTFLoader);

/**
 * loads COLLADA models
 * @see https://en.wikipedia.org/wiki/COLLADA
 */
export const loadCollada = async (url: string): Promise<Collada> => await loadModel(url, ColladaLoader);
