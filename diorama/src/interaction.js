import * as THREE from 'three';
import { sfx } from './audio/sfx.js';

/**
 * Hover and click for everything in the diorama that answers back. Each
 * item gets a springy little lift when the cursor finds it and a squash when
 * it's clicked, and the interface shows a label beside the cursor.
 */
export default class Interaction {
    constructor({ camera, dom, rig, ui }) {
        this.camera = camera;
        this.dom = dom;
        this.rig = rig;
        this.ui = ui;
        this.items = [];
        this.meshes = [];
        this.lookup = new Map();
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2(2, 2);
        this.client = { x: 0, y: 0 };
        this.hovered = null;
        this.enabled = true;
        this.dirty = false;
        this.down = null;

        dom.addEventListener('pointermove', (e) => {
            this.setPointer(e);
            if (e.pointerType === 'mouse') this.dirty = true;
        });
        dom.addEventListener('pointerdown', (e) => {
            this.setPointer(e);
            this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
            document.body.classList.add('dragging');
        });
        window.addEventListener('pointerup', (e) => {
            document.body.classList.remove('dragging');
            const d = this.down;
            this.down = null;
            if (!d || !this.enabled) return;
            if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
            this.setPointer(e);
            // touch has no hover: pick right where the finger lifted
            const item = this.pick();
            if (item) this.click(item);
            else if (e.pointerType !== 'mouse') this.setHovered(null);
        });
        dom.addEventListener('pointerleave', () => {
            this.ndc.set(2, 2);
            this.dirty = true;
        });
    }

    setPointer(e) {
        this.client.x = e.clientX;
        this.client.y = e.clientY;
        this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    }

    add(item) {
        item.scale = 1;
        item.velocity = 0;
        item.target = 1;
        item.baseScale = item.root.scale.clone();
        this.items.push(item);
        for (const m of item.meshes) {
            this.lookup.set(m, item);
            this.meshes.push(m);
        }
        return item;
    }

    pick() {
        if (this.ndc.x > 1.5) return null;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
        return hit ? this.lookup.get(hit.object) : null;
    }

    click(item) {
        // squash, then spring back
        item.velocity -= 2.2;
        item.onClick?.();
        if (this.hovered === item) this.ui.label(item, this.client.x, this.client.y);
    }

    setHovered(item) {
        if (item === this.hovered) return;
        if (this.hovered) {
            this.hovered.onHover?.(false);
            this.hovered.target = 1;
        }
        this.hovered = item;
        if (item) {
            item.onHover?.(true);
            item.target = 1.025;
            item.velocity += 0.9;
            sfx.hover();
        }
        document.body.classList.toggle('hovering', !!item);
    }

    update(dt) {
        if (!this.enabled) {
            if (this.hovered) this.setHovered(null);
            this.ui.hideLabel();
        } else if (this.dirty && !this.rig.isDragging) {
            this.dirty = false;
            this.setHovered(this.pick());
        }
        if (this.hovered && this.enabled && !this.rig.isDragging) this.ui.label(this.hovered, this.client.x, this.client.y);
        else this.ui.hideLabel();

        // springs
        const k = 260, c = 16;
        for (const item of this.items) {
            const a = (item.target - item.scale) * k - item.velocity * c;
            item.velocity += a * dt;
            item.scale += item.velocity * dt;
            if (Math.abs(item.scale - 1) > 1e-4 || Math.abs(item.velocity) > 1e-4) {
                item.root.scale.copy(item.baseScale).multiplyScalar(item.scale);
            }
        }
    }
}
