import * as THREE from 'three';
import { sceneSetup } from '../core/SceneSetup.js';
import { events, EVENTS, DIRECTOR_EVENTS } from '../core/Events.js';

export class Water {
    constructor() {
        this.mesh = null;
        this.material = null;
    }

    init() {
        // Eine riesige, einfache Fläche
        const geometry = new THREE.PlaneGeometry(4000, 4000, 1, 1);

        this.material = new THREE.MeshBasicMaterial({
            color: 0x2E86C1,
            side: THREE.DoubleSide,
            // MOBILE FIX: polygonOffset
            // Das sagt der GPU: "Tu so, als wäre dieses Objekt weiter weg."
            // Dadurch wird die Insel immer VOR dem Wasser gezeichnet,
            // selbst wenn die Tiefenberechnung des Handys ungenau ist.
            polygonOffset: true,
            polygonOffsetFactor: 15, // Starker Offset für maximale Sicherheit auf alten Geräten
            polygonOffsetUnits: 15
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;

        // Höhe leicht unter 0, damit der Strand gut aussieht
        this.mesh.position.y = -2.5;

        // Verhindert, dass das Wasser ausgeblendet wird, wenn man an den Rand schaut
        this.mesh.frustumCulled = false;

        // Wir zeichnen das Wasser ganz am Anfang als Hintergrund
        this.mesh.renderOrder = -1;

        this.mesh.receiveShadow = false;

        if (sceneSetup && sceneSetup.scene) {
            sceneSetup.scene.add(this.mesh);
        }

        // Leere Listener um Abstürze zu verhindern
        events.on(EVENTS.STATS_UPDATED, () => {});
        events.on(DIRECTOR_EVENTS.PHASE_CHANGED, () => {});
    }

    update(time) {
        // Keine Animation = Maximale Performance
    }
}
