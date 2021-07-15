import {Component, ComponentInterface, Element} from '@stencil/core';
import {AmbientLight, PerspectiveCamera, Scene, WebGLRenderer} from 'three';
import {GLTF, GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';

@Component({
  tag: 'kvlm-terrain',
  shadow: true,
})
export class Terrain implements ComponentInterface {

  @Element()
  private readonly _elementRef!: HTMLKvlmTerrainElement;

  private readonly _loader = new GLTFLoader();

  private readonly _renderer = new WebGLRenderer();

  private readonly _camera = new PerspectiveCamera(500, window.innerWidth / window.innerHeight, 0.1, 1000);

  // @ts-ignore
  private readonly _scene = new Scene();

  componentDidLoad() {
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._elementRef.shadowRoot.appendChild(this._renderer.domElement);
    this._loader.load(
      '/assets/models/Lotzebachstraße.glb',
      gltf => this.sceneDidLoad(gltf),
      xhr => console.log((xhr.loaded / xhr.total * 100) + '% loaded'),
      error => console.error(error),
    );
  }

  sceneDidLoad(gltf: GLTF) {
    this._scene.add(gltf.scene);
    this._scene.add(new AmbientLight());
    this._camera.translateY(-300);
    this._camera.translateZ(-600);
    this._camera.rotateX(-25);
  }

}
