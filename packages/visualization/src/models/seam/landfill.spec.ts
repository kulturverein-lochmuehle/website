import { expect } from '@open-wc/testing';

import { Landfill } from './landfill.js';

/** The landfill's own contract: it only ever piles onto the ground it is given. */
describe('the landfill', () => {
  // a slope rising a meter in ten eastwards, so the brushes have something to read
  const slope = (x: number) => x / 10;

  it('should pile ground on where it is raised, most in the middle', () => {
    const fill = new Landfill(slope);
    fill.dab(['raise', 0, 0, 2, 1]);

    expect(fill.heightAt(0, 0)).to.be.closeTo(0.1, 1e-9);
    expect(fill.heightAt(1, 0)).to.be.greaterThan(slope(1));
    expect(fill.heightAt(1, 0)).to.be.lessThan(slope(1) + 0.1);
    expect(fill.heightAt(3, 0)).to.be.closeTo(slope(3), 1e-9);
  });

  it('should never take the ground away it is piled on', () => {
    const fill = new Landfill(slope);
    fill.dab(['raise', 0, 0, 2, 0.5]);
    Array.from({ length: 5 }, () => fill.dab(['lower', 0, 0, 2, 1]));

    expect(fill.heightAt(0, 0)).to.be.closeTo(0, 1e-9);
    expect(fill.empty).to.be.true;
  });

  it('should flatten towards the height it is given, and no lower than the ground', () => {
    const fill = new Landfill(slope);
    Array.from({ length: 20 }, () => fill.dab(['flatten', 0, 0, 3, 1, 0.1]));

    expect(fill.heightAt(0, 0)).to.be.closeTo(0.1, 1e-3);
    // east of a meter the ground stands higher than that, and stays
    expect(fill.heightAt(2, 0)).to.be.closeTo(slope(2), 1e-9);
  });

  it('should smooth what is piled on, but not the ground under it', () => {
    const fill = new Landfill(slope);
    fill.dab(['raise', 0, 0, 0.5, 1]);
    const peak = fill.heightAt(0, 0) as number;
    Array.from({ length: 10 }, () => fill.dab(['smooth', 0, 0, 2, 1]));

    expect(fill.heightAt(0, 0)).to.be.lessThan(peak);
    expect(fill.heightAt(-1, 0)).to.be.at.least(slope(-1));
  });

  it('should lay the same strokes on the same way every time', () => {
    const strokes = [
      ['raise', 0, 0, 2, 0.5],
      ['smooth', 0.5, 0, 1, 0.5],
      ['flatten', 1, 0, 1.5, 0.8, 0.2],
    ] as const;
    const [one, other] = [new Landfill(slope), new Landfill(slope)];
    strokes.forEach(stroke => {
      one.dab([...stroke] as Parameters<Landfill['dab']>[0]);
      other.dab([...stroke] as Parameters<Landfill['dab']>[0]);
    });

    expect(one.heightAt(0.3, 0.2)).to.equal(other.heightAt(0.3, 0.2));
  });

  it('should draw only where something is piled on', () => {
    const fill = new Landfill(slope);
    const tint = () => [0.5, 0.5, 0.5];

    expect(fill.geometry(tint).getIndex()?.count ?? 0).to.equal(0);
    fill.dab(['raise', 0, 0, 1, 1]);
    expect(fill.geometry(tint).getIndex()?.count ?? 0).to.be.greaterThan(0);
  });
});
