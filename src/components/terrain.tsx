import { Build, Component, ComponentInterface, Element, Listen } from '@stencil/core';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';

import { loadGltf } from '../utils/model-loader.utils';
import { Lotzebachstraße } from '../assets/models/Lotzebachstraße';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

@Component({
  tag: 'kvlm-terrain',
  shadow: true,
})
export class Terrain implements ComponentInterface {

  @Element()
  private readonly _elementRef!: HTMLKvlmTerrainElement;

  private readonly _renderer = new WebGLRenderer();

  private readonly _camera = new PerspectiveCamera(20, window.innerWidth / window.innerHeight, 1, 1000);

  private readonly _ambientLight = new AmbientLight(0xcccccc, .4);

  private readonly _directionalLight = new DirectionalLight(0xffffff, .8);

  private readonly _scene = new Scene();

  private readonly _stats = Stats();

  private readonly _controls = new OrbitControls(this._camera, this._renderer.domElement);

  async componentDidLoad() {
    // 1. init the renderer initially
    this._scene.background = new Color(0x333333);
    this._renderer.shadowMap.enabled = true;
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    // 2. position camera
    this._camera.position.set(0, 200, 600);
    this._camera.lookAt(0, 1, 0);

    // 3. position lights
    this._directionalLight.position.set(1, 1, 0).normalize();
    this._scene.add(this._ambientLight);
    this._scene.add(this._directionalLight);

    // 4. assign the canvas output to the elements shadow DOM
    this._elementRef.shadowRoot.appendChild(this._renderer.domElement);
    if (Build.isDev) this._elementRef.shadowRoot.appendChild(this._stats.domElement);

    // 5. load the model
    const { scene } = await loadGltf('/assets/models/Lotzebachstraße.glb');
    this._scene.add(scene);

    // 6. start rendering
    this.renderScene();

    const { children: [{ children: [buildings, surface] }] } = scene as unknown as Lotzebachstraße;
    const { children: [mill, workshop, falk] } = buildings;

    // this._scene.fog = new Fog(0x333333, 0, 1000);
    const house = new MeshStandardMaterial({ fog: true, color: 0xFFFFFF, wireframe: false, flatShading: true });
    const earth = new MeshStandardMaterial({ fog: true, color: 0x666666, wireframe: false, flatShading: false });
    mill.material = workshop.material = falk.material = house;
    surface.material = earth;
  }

  @Listen('resize', { passive: true, target: 'window' })
  windowDidResize() {
    // update the renderer dimensions...
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    // ... but set the new aspect ratio to the camera as well
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
  }

  renderScene() {
    window.requestAnimationFrame(() => this.renderScene());
    this._controls.update();
    this._stats.update();
    this._renderer.render(this._scene, this._camera);
  }

}
