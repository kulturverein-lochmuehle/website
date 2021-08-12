import { Mesh, Object3D } from 'three';

export type Lotzebachstraße = Object3D & {
  children: [Group];
}

export type Group = Object3D & {
  children: [Buildings, Surface];
}

export type Buildings = Object3D & {
  children: [Mill, Workshop, Falk];
};

export type Mill = Mesh;

export type Workshop = Mesh;

export type Falk = Mesh;

export type Surface = Mesh;
