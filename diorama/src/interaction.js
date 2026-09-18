import * as THREE from 'three';
import { sfx } from './audio/sfx.js';

// visible, and so is everything it hangs from
function shown(object) {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
}

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
        this.raycaster.layers.enableAll();
        this.ndc = new THREE.Vector2(2, 2);
        this.client = { x: 0, y: 0 };
        this.hovered = null;
        this.enabled = true;
        this.dirty = false;
        this.down = null;
        // first person: pick from the middle of the screen, within reach
        this.center = false;
        this.reach = 3.2;
        // return false to swallow a click (first person uses it to grab the mouse)
        this.beforeClick = null;
        this.blockers = [];

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
            if (this.beforeClick && this.beforeClick() === false) return;
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

    /**
     * item.bounce = false for things too big to bounce as a whole (the prize
     * wall): they animate their own parts instead.
     */
    add(item) {
        item.bounce = item.bounce !== false;
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
        if (this.center) {
            this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
            this.raycaster.far = this.reach;
        } else {
            if (this.ndc.x > 1.5) return null;
            this.raycaster.setFromCamera(this.ndc, this.camera);
            this.raycaster.far = Infinity;
        }
        // Standing walls block the ray; anything folded away (invisible) is skipped.
        const hits = this.raycaster.intersectObjects(this.blockers.length ? this.meshes.concat(this.blockers) : this.meshes, false);
        for (const hit of hits) {
            if (!shown(hit.object)) continue;
            return this.lookup.get(hit.object) || null;
        }
        return null;
    }

    /** Meshes that stop a pick without being pickable themselves (walls). */
    setBlockers(meshes) {
        this.blockers = meshes;
    }

    click(item) {
        // squash, then spring back
        if (item.bounce) item.velocity = Math.min(item.velocity, -2.2);
        item.onClick?.();
        if (this.hovered === item) this.ui.label(item, this.client.x, this.client.y);
    }

    // Losing the hover needs a moment's grace: a bouncing prop can slip out
    // from under a still cursor and back, and must not flicker in and out.
    hover(item, dt) {
        if (item) {
            this.grace = 0.15;
            this.setHovered(item);
        } else if (this.hovered) {
            this.grace = (this.grace || 0) - dt;
            if (this.grace <= 0 || this.ndc.x > 1.5) this.setHovered(null);
        }
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
            if (item.bounce) {
                item.target = 1.025;
                // a nudge, not an accumulation: rapid hover in/out can't stack up
                item.velocity = Math.max(item.velocity, 0.9);
            }
            sfx.hover();
        }
        document.body.classList.toggle('hovering', !!item);
    }

    update(dt) {
        if (!this.enabled) {
            if (this.hovered) this.setHovered(null);
            this.ui.hideLabel();
        } else if (this.center || (this.dirty && !this.rig.isDragging) || this.hovered) {
            this.dirty = false;
            this.hover(this.pick(), dt);
        }
        if (this.hovered && this.enabled && !this.rig.isDragging) {
            if (this.center) this.ui.label(this.hovered, window.innerWidth / 2 + 6, window.innerHeight / 2 + 4);
            else this.ui.label(this.hovered, this.client.x, this.client.y);
        } else this.ui.hideLabel();

        // Springs, integrated in small fixed steps (semi-implicit Euler) so a
        // long frame can never pump energy into them, and clamped as a last
        // line of defence: a prop may bob, it may never balloon.
        const k = 260, c = 16, h = 1 / 240;
        const steps = Math.min(Math.ceil(dt / h), 60);
        for (const item of this.items) {
            for (let i = 0; i < steps; i++) {
                item.velocity += ((item.target - item.scale) * k - item.velocity * c) * h;
                item.scale += item.velocity * h;
            }
            item.velocity = Math.max(-3, Math.min(3, item.velocity));
            item.scale = Math.max(0.93, Math.min(1.07, item.scale));
            if (Math.abs(item.scale - 1) > 1e-4 || Math.abs(item.velocity) > 1e-4) {
                item.root.scale.copy(item.baseScale).multiplyScalar(item.scale);
            } else if (item.scale !== 1) {
                item.scale = 1;
                item.velocity = 0;
                item.root.scale.copy(item.baseScale);
            }
        }
    }
}
