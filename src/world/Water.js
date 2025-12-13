import * as THREE from 'three';
import { sceneSetup } from '../core/SceneSetup.js';
import { events, EVENTS, DIRECTOR_EVENTS } from '../core/Events.js';

// OPTIMIERUNG für Tab A 2016 (Mali-T830 MP1 GPU):
// Der alte Fragment-Shader berechnete per-Pixel Simplex Noise - EXTREM teuer!
// Neue Strategie: Alle Berechnungen (Wellen, Farben) im VERTEX-Shader.
// Der Fragment-Shader macht fast nichts mehr -> Massive Performance-Steigerung.

// Noise Funktion (nur noch im Vertex Shader genutzt)
const noiseFunction = `
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }
`;

const vertexShader = `
    uniform float uTime;

    // Farben direkt im Vertex Shader mischen!
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;

    varying vec3 vColor; // Wir übergeben nur die fertige Farbe an den Fragment Shader

    ${noiseFunction}

    void main() {
        vec3 pos = position;
        float dist = length(pos.xy);

        // Geometrie verformen (Wellen)
        float waveMask = smoothstep(140.0, 300.0, dist);
        float waveStrength = mix(0.0, 1.0, waveMask);

        // Einfachere Sinus-Wellen + ein einziger Noise-Call (statt mehrere im Fragment-Shader!)
        float bigWave = sin(pos.x * 0.05 + uTime * 0.8) * sin(pos.y * 0.05 + uTime * 0.6);
        float detailWave = snoise(vec2(pos.x * 0.03, pos.y * 0.03 + uTime * 0.2)); // Noise nur 1x

        float elevation = (bigWave + detailWave) * 1.5 * waveStrength;

        // Insel absenken
        float sinkMask = smoothstep(130.0, 155.0, dist);
        pos.z += elevation - (15.0 * (1.0 - sinkMask));

        // FARBBERECHNUNG (Vertex-Level = Billig & Schnell)
        float lagoonFactor = 1.0 - smoothstep(140.0, 300.0, dist);

        // Basis-Mix (Tief -> Flach)
        vec3 col = mix(uColorDeep, uColorShallow, lagoonFactor);

        // Schaum auf Wellenspitzen
        float foamFactor = smoothstep(0.5, 1.2, elevation);
        col = mix(col, uColorFoam, foamFactor * 0.5);

        vColor = col;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

// Der Fragment Shader macht jetzt fast NICHTS mehr -> Maximale Performance
const fragmentShader = `
    varying vec3 vColor;

    void main() {
        gl_FragColor = vec4(vColor, 0.95);
    }
`;

export class Water {
    constructor() {
        this.mesh = null;
        this.material = null;

        this.colorsHealthy = {
            deep: new THREE.Color('#2E86C1'),    // Klares Tiefblau
            shallow: new THREE.Color('#85C1E9'), // Helles Türkis
            foam: new THREE.Color('#FFFFFF')     // Weißer Schaum
        };

        this.colorsDead = {
            deep: new THREE.Color('#2F3E30'),    // Sumpfiges Dunkelgrün
            shallow: new THREE.Color('#8B8560'), // Trübes Braun-Gelb
            foam: new THREE.Color('#C2B280')     // Dreckiger Schaum
        };

        this.currentHealth = 1.0;
        this.targetHealth = 1.0;

        this.uniformColors = {
            deep: this.colorsHealthy.deep.clone(),
            shallow: this.colorsHealthy.shallow.clone(),
            foam: this.colorsHealthy.foam.clone()
        };
    }

    init() {
        // OPTIMIERUNG (Tab A 2016): 48x48 Segmente reichen für Wellen auf kleinem Bildschirm
        const geometry = new THREE.PlaneGeometry(1000, 1000, 48, 48);

        this.material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColorDeep: { value: this.uniformColors.deep },
                uColorShallow: { value: this.uniformColors.shallow },
                uColorFoam: { value: this.uniformColors.foam }
                // SunDirection entfernt, da wir im VertexShader kein Licht berechnen
            },
            transparent: true
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = -1.5;

        if (sceneSetup && sceneSetup.scene) {
            sceneSetup.scene.add(this.mesh);
        }

        // Listener: Wasserqualität hängt direkt am Fischbestand
        events.on(EVENTS.STATS_UPDATED, (stats) => {
            let ratio = stats.fishStock / stats.maxFishStock;
            this.targetHealth = Math.max(0, Math.min(1, ratio));
        });

        events.on(DIRECTOR_EVENTS.PHASE_CHANGED, (data) => {
            if (data.phaseId === 'COLLAPSE') {
                this.targetHealth = 0.0;
            }
        });
    }

    update(time) {
        if (!this.material) return;
        this.material.uniforms.uTime.value = time;

        // Sehr langsame, fließende Anpassung der Farbe
        const lerpSpeed = 0.005;
        this.currentHealth += (this.targetHealth - this.currentHealth) * lerpSpeed;

        this.updateColors(this.currentHealth);
    }

    updateColors(factor) {
        this.material.uniforms.uColorDeep.value.lerpColors(
            this.colorsDead.deep,
            this.colorsHealthy.deep,
            factor
        );

        this.material.uniforms.uColorShallow.value.lerpColors(
            this.colorsDead.shallow,
            this.colorsHealthy.shallow,
            factor
        );

        this.material.uniforms.uColorFoam.value.lerpColors(
            this.colorsDead.foam,
            this.colorsHealthy.foam,
            factor
        );
    }
}
