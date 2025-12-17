import * as THREE from 'three';
import { sceneSetup } from '../core/SceneSetup.js';
import { events, EVENTS, DIRECTOR_EVENTS } from '../core/Events.js';

export class Water {
    constructor() {
        this.mesh = null;
        this.material = null;
        this.currentHealth = 1.0;
    }

    init() {
        // PERFORMANCE: 1x1 Segment reicht für statisches Wasser
        const geometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);

        this.material = new THREE.MeshStandardMaterial({
            color: 0x2E86C1,
            roughness: 0.4,
            metalness: 0.1,
            flatShading: false,
            // WICHTIG: Undurchsichtig, um Grafikfehler zu vermeiden und Leistung zu sparen
            transparent: false,
            opacity: 1.0
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;

        // FIX: Wasserspiegel auf -4.0 senken.
        // 0 war zu hoch (Überflutung), -10 ist der Meeresboden.
        // -4.0 zeigt mehr Strand und lässt die Insel besser zur Geltung kommen.
        this.mesh.position.y = -4.0;

        this.mesh.receiveShadow = true;

        if (sceneSetup && sceneSetup.scene) {
            sceneSetup.scene.add(this.mesh);
        }

        events.on(EVENTS.STATS_UPDATED, () => {});
        events.on(DIRECTOR_EVENTS.PHASE_CHANGED, () => {});
    }

    update(time) {
        // Keine Animation
    }
}
