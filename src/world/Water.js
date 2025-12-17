import * as THREE from 'three';
import { sceneSetup } from '../core/SceneSetup.js';
import { events, EVENTS, DIRECTOR_EVENTS } from '../core/Events.js';

export class Water {
    constructor() {
        this.mesh = null;
        this.material = null;
    }

    init() {
        // PERFORMANCE & STABILITÄT:
        // Wir machen die Plane riesig, damit man nie den Rand sieht.
        const geometry = new THREE.PlaneGeometry(4000, 4000, 1, 1);

        // FIX: MeshBasicMaterial ignoriert Lichtberechnungen.
        // Das verhindert schwarzes Wasser auf Handys, die Shader nicht mögen.
        this.material = new THREE.MeshBasicMaterial({
            color: 0x2E86C1,
            side: THREE.DoubleSide, // Verhindert Unsichtbarkeit bei falschen Winkeln
            transparent: false
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;

        // FIX: Höhe leicht absenken
        this.mesh.position.y = -3.5;

        // --- MOBILE FIXES ---

        // 1. Frustum Culling aus: Das Wasser darf NIE ausgeblendet werden,
        // egal wohin die Kamera schaut.
        this.mesh.frustumCulled = false;

        // 2. Render Order Fix: Wir zwingen das Wasser, VOR allem anderen gemalt zu werden.
        // Es verhält sich wie ein Skybox-Boden. Die Insel wird einfach darüber gemalt.
        // Das löst das Problem "Wasser über der Insel" zu 100%.
        this.mesh.renderOrder = -1;

        // Keine Schatten empfangen (spart Rechenleistung und vermeidet Artefakte auf Mobile)
        this.mesh.receiveShadow = false;

        if (sceneSetup && sceneSetup.scene) {
            sceneSetup.scene.add(this.mesh);
        }

        // Leere Listener für Code-Kompatibilität
        events.on(EVENTS.STATS_UPDATED, () => {});
        events.on(DIRECTOR_EVENTS.PHASE_CHANGED, () => {});
    }

    update(time) {
        // Statisch
    }
}
