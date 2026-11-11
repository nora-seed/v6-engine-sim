import * as THREE from 'three';
import { EngineGeometry, Vec3 } from './types';

export class V6Engine {
  public group: THREE.Group;
  public cylinders: CylinderAssembly[] = [];
  public crankshaft!: THREE.Group;
  public camshafts: { intake: THREE.Group; exhaust: THREE.Group }[] = [];
  private renderer: THREE.WebGLRenderer | null = null;
  public geometry: EngineGeometry;

  private readonly firingOrder = [0, 5, 4, 3, 2, 1];
  private readonly crankAngles: number[];

  constructor(geometry: EngineGeometry) {
    this.geometry = geometry;
    this.group = new THREE.Group();
    this.group.name = 'V6Engine';

    this.crankAngles = this.computeCrankAngles();

    this.buildBlock();
    this.buildCrankshaft();
    this.buildCylinders();
    this.buildCamshafts();
    this.buildAccessories();
  }

  private computeCrankAngles(): number[] {
    const { vAngle, crankType } = this.geometry;
    const angles = new Array(6).fill(0);
    const baseInterval = 720 / 6;

    if (crankType === 'flat') {
      this.firingOrder.forEach((cyl, i) => {
        angles[cyl] = i * baseInterval;
      });
    } else {
      const offset = vAngle === 90 ? 30 : 0;
      this.firingOrder.forEach((cyl, i) => {
        const bank = cyl % 2;
        const pair = Math.floor(cyl / 2);
        angles[cyl] = i * baseInterval + (bank === 1 ? offset : 0);
      });
    }
    return angles.map(a => (a % 720) * Math.PI / 180);
  }

  private buildBlock(): void {
    const { bore, stroke, vAngle, deckHeight } = this.geometry;
    const blockMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a3a4a, roughness: 0.7, metalness: 0.6
    });

    const crankcase = new THREE.Mesh(
      new THREE.BoxGeometry(bore * 3.5, stroke * 1.8, bore * 2.2),
      blockMaterial
    );
    crankcase.position.y = -stroke * 0.6;
    this.group.add(crankcase);

    const bankAngle = (vAngle / 2) * Math.PI / 180;
    const bankSpacing = bore * 1.15;

    for (let bank = 0; bank < 2; bank++) {
      const sign = bank === 0 ? -1 : 1;
      const bankGroup = new THREE.Group();
      bankGroup.rotation.z = sign * bankAngle;

      for (let i = 0; i < 3; i++) {
        const y = -stroke * 0.6 + deckHeight + i * bankSpacing;
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(bore / 2, bore / 2, stroke + 20, 32),
          blockMaterial
        );
        cyl.position.y = y;
        cyl.rotation.x = Math.PI / 2;
        bankGroup.add(cyl);

        if (this.geometry.vAngle <= 60) {
          for (let f = 0; f < 8; f++) {
            const fin = new THREE.Mesh(
              new THREE.RingGeometry(bore / 2, bore / 2 + 8, 32, 1, f * Math.PI / 4, Math.PI / 4),
              new THREE.MeshStandardMaterial({ color: 0x3a4a5a, side: THREE.DoubleSide, roughness: 0.8 })
            );
            fin.position.y = y + (f - 3.5) * 12;
            fin.rotation.x = Math.PI / 2;
            bankGroup.add(fin);
          }
        }
      }
      this.group.add(bankGroup);
    }

    const headMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.6, metalness: 0.7 });
    for (let bank = 0; bank < 2; bank++) {
      const sign = bank === 0 ? -1 : 1;
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(bore * 3.2, 45, bore * 2.5),
        headMaterial
      );
      head.position.set(0, deckHeight + stroke + 22, 0);
      head.rotation.z = sign * bankAngle;
      this.group.add(head);
    }
  }

  private buildCrankshaft(): void {
    const { stroke, rodLength, vAngle, crankType } = this.geometry;
    const crankRadius = stroke / 2;
    const mainJournalRadius = 28;
    const rodJournalRadius = 26;
    const crankMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.3, metalness: 0.9 });

    this.crankshaft = new THREE.Group();
    this.crankshaft.name = 'Crankshaft';

    const mainPositions = [-1, -0.33, 0.33, 1].map(m => m * (stroke * 1.15 * 1.5));
    mainPositions.forEach(y => {
      const journal = new THREE.Mesh(
        new THREE.CylinderGeometry(mainJournalRadius, mainJournalRadius, 30, 24),
        crankMaterial
      );
      journal.position.y = y;
      journal.rotation.x = Math.PI / 2;
      this.crankshaft.add(journal);
    });

    const throwsPerRev = crankType === 'flat' ? 6 : 3;
    const throwAngleStep = (2 * Math.PI) / throwsPerRev;

    for (let i = 0; i < 6; i++) {
      const throwGroup = new THREE.Group();
      const angle = this.crankAngles[i];

      const web = new THREE.Mesh(
        new THREE.BoxGeometry(12, crankRadius + 10, 40),
        crankMaterial
      );
      web.position.set(
        Math.sin(angle) * (crankRadius + 5),
        mainPositions[Math.floor(i / 1.5)] + (i % 2 === 0 ? -20 : 20),
        Math.cos(angle) * (crankRadius + 5)
      );
      web.rotation.z = angle;
      throwGroup.add(web);

      const rodJournal = new THREE.Mesh(
        new THREE.CylinderGeometry(rodJournalRadius, rodJournalRadius, 32, 24),
        crankMaterial
      );
      rodJournal.position.set(
        Math.sin(angle) * crankRadius,
        mainPositions[Math.floor(i / 1.5)] + (i % 2 === 0 ? -20 : 20),
        Math.cos(angle) * crankRadius
      );
      rodJournal.rotation.x = Math.PI / 2;
      throwGroup.add(rodJournal);

      const cw = new THREE.Mesh(
        new THREE.BoxGeometry(55, 18, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.4, metalness: 0.8 })
      );
      cw.position.set(
        -Math.sin(angle) * 65,
        mainPositions[Math.floor(i / 1.5)] + (i % 2 === 0 ? -20 : 20),
        -Math.cos(angle) * 65
      );
      cw.rotation.z = angle;
      throwGroup.add(cw);

      this.crankshaft.add(throwGroup);
    }

    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(120, 120, 18, 32),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.9 })
    );
    flywheel.position.y = mainPositions[3] + 40;
    flywheel.rotation.x = Math.PI / 2;
    this.crankshaft.add(flywheel);

    for (let t = 0; t < 120; t++) {
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(3, 6, 4),
        new THREE.MeshStandardMaterial({ color: 0x333 })
      );
      const a = (t / 120) * Math.PI * 2;
      tooth.position.set(Math.sin(a) * 122, mainPositions[3] + 40, Math.cos(a) * 122);
      tooth.rotation.y = a;
      this.crankshaft.add(tooth);
    }

    this.crankshaft.position.y = -this.geometry.stroke * 0.6;
    this.group.add(this.crankshaft);
  }

  private buildCylinders(): void {
    const { bore, stroke, rodLength, vAngle, pistonPinOffset } = this.geometry;
    const pistonMaterial = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.4, metalness: 0.7 });
    const rodMaterial = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.3, metalness: 0.85 });
    const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa, roughness: 0.2, metalness: 0.9 });

    const bankAngle = (vAngle / 2) * Math.PI / 180;
    const bankSpacing = bore * 1.15;
    const deckHeight = this.geometry.deckHeight;

    for (let cyl = 0; cyl < 6; cyl++) {
      const bank = cyl % 2;
      const cylinderIndex = Math.floor(cyl / 2);
      const sign = bank === 0 ? -1 : 1;

      const assembly = new CylinderAssembly(cyl);

      const piston = new THREE.Mesh(
        new THREE.CylinderGeometry(bore / 2 - 0.5, bore / 2 - 0.5, 55, 32),
        pistonMaterial
      );
      piston.position.y = deckHeight + stroke / 2;
      assembly.piston = piston;
      assembly.group.add(piston);

      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(11, 11, bore - 4, 16),
        pinMaterial
      );
      pin.rotation.z = Math.PI / 2;
      pin.position.y = deckHeight + stroke / 2 - 5;
      assembly.pin = pin;
      assembly.group.add(pin);

      const rod = new THREE.Mesh(
        new THREE.BoxGeometry(18, rodLength - 10, 12),
        rodMaterial
      );
      rod.position.y = deckHeight - rodLength / 2;
      assembly.rod = rod;
      assembly.group.add(rod);

      const valveMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa, roughness: 0.2, metalness: 0.9 });
      const valveRadius = bore * 0.18;
      for (let v = 0; v < 4; v++) {
        const isIntake = v < 2;
        const valve = new THREE.Mesh(
          new THREE.CylinderGeometry(valveRadius, valveRadius, 85, 16),
          valveMaterial
        );
        valve.position.y = deckHeight + stroke + 60;
        valve.userData = { isIntake, lift: 0, maxLift: isIntake ? 11 : 10 };
        assembly.valves.push(valve);
        assembly.group.add(valve);
      }

      const plug = new THREE.Mesh(
        new THREE.CylinderGeometry(5, 5, 35, 12),
        new THREE.MeshStandardMaterial({ color: 0xf0e0a0, roughness: 0.3, metalness: 0.6 })
      );
      plug.position.set(0, deckHeight + stroke + 45, bore * 0.35);
      assembly.group.add(plug);

      const injector = new THREE.Mesh(
        new THREE.CylinderGeometry(6, 6, 60, 12),
        new THREE.MeshStandardMaterial({ color: 0x333, roughness: 0.4, metalness: 0.8 })
      );
      injector.position.set(0, deckHeight + stroke + 70, -bore * 0.35);
      assembly.group.add(injector);

      assembly.group.rotation.z = sign * bankAngle;
      assembly.group.position.y = cylinderIndex * bankSpacing;

      this.cylinders.push(assembly);
      this.group.add(assembly.group);
    }
  }

  private buildCamshafts(): void {
    const { bore, stroke, vAngle } = this.geometry;
    const camMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.3, metalness: 0.9 });
    const lobeMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.4, metalness: 0.85 });

    const bankAngle = (vAngle / 2) * Math.PI / 180;
    const bankSpacing = bore * 1.15;

    for (let bank = 0; bank < 2; bank++) {
      const sign = bank === 0 ? -1 : 1;
      for (let type = 0; type < 2; type++) {
        const cam = new THREE.Group();
        cam.name = `${bank === 0 ? 'L' : 'R'}_${type === 0 ? 'Intake' : 'Exhaust'}Cam`;

        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(12, 12, bankSpacing * 2 + 60, 16),
          camMaterial
        );
        shaft.rotation.x = Math.PI / 2;
        cam.add(shaft);

        for (let i = 0; i < 3; i++) {
          const lobe = new THREE.Mesh(
            new THREE.CylinderGeometry(18, 18, 22, 16, 1, true, 0, Math.PI * 1.5),
            lobeMaterial
          );
          lobe.rotation.x = Math.PI / 2;
          lobe.position.x = (i - 1) * bankSpacing;
          lobe.rotation.z = i * Math.PI * 2 / 3;
          cam.add(lobe);
        }

        cam.rotation.z = sign * bankAngle;
        cam.position.y = -stroke * 0.6 + this.geometry.deckHeight + stroke + 50;
        if (!this.camshafts[bank]) this.camshafts[bank] = { intake: new THREE.Group(), exhaust: new THREE.Group() };
        this.camshafts[bank][type === 0 ? 'intake' : 'exhaust'] = cam;
        this.group.add(cam);
      }
    }
  }

  private buildAccessories(): void {
    const accMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.7 });
    const pulleyMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.8 });

    const accessories = [
      { name: 'Alternator', pos: new THREE.Vector3(180, -40, 120), size: [60, 80, 50] },
      { name: 'AC_Compressor', pos: new THREE.Vector3(-180, -40, 120), size: [70, 90, 60] },
      { name: 'Water_Pump', pos: new THREE.Vector3(0, -100, 0), size: [50, 40, 50] },
      { name: 'Oil_Pump', pos: new THREE.Vector3(0, -140, 0), size: [40, 30, 40] }
    ];

    accessories.forEach(acc => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(...acc.size), accMaterial);
      body.position.copy(acc.pos);
      this.group.add(body);

      const pulley = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 12, 24), pulleyMaterial);
      pulley.position.copy(acc.pos).add(new THREE.Vector3(0, 0, acc.size[2] / 2 + 6));
      pulley.rotation.x = Math.PI / 2;
      this.group.add(pulley);
    });

    const beltPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -140, 56),
      new THREE.Vector3(180, -40, 146),
      new THREE.Vector3(0, -100, 56),
      new THREE.Vector3(-180, -40, 146),
      new THREE.Vector3(0, -140, 56)
    ]);
    const beltGeom = new THREE.TubeGeometry(beltPath, 64, 4, 8, true);
    const belt = new THREE.Mesh(beltGeom, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
    this.group.add(belt);
  }

  update(crankAngle: number, vvtIntake: number, vvtExhaust: number): void {
    const { stroke, rodLength, vAngle, pistonPinOffset } = this.geometry;
    const crankRadius = stroke / 2;
    const bankAngle = (vAngle / 2) * Math.PI / 180;
    const bankSpacing = this.geometry.bore * 1.15;

    this.crankshaft.rotation.x = crankAngle;

    this.cylinders.forEach((cyl, i) => {
      const bank = i % 2;
      const cylIndex = Math.floor(i / 2);
      const sign = bank === 0 ? -1 : 1;
      const crankPinAngle = crankAngle + this.crankAngles[i];

      const x = Math.sin(crankPinAngle) * crankRadius;
      const y = Math.cos(crankPinAngle) * crankRadius;
      const rodAngle = Math.asin(Math.min(1, Math.max(-1, x / rodLength)));
      const pistonY = y + Math.cos(rodAngle) * rodLength;

      cyl.piston.position.y = this.geometry.deckHeight + stroke / 2 - pistonY;
      cyl.pin.position.y = cyl.piston.position.y - 5;

      cyl.rod.position.y = this.geometry.deckHeight - pistonY + rodLength / 2;
      cyl.rod.rotation.z = sign * bankAngle - rodAngle * sign;

      const camAngle = (crankAngle / 2) % (Math.PI * 2);
      const intakePhase = (this.crankAngles[i] / 2) + vvtIntake * Math.PI / 180;
      const exhaustPhase = (this.crankAngles[i] / 2) + Math.PI + vvtExhaust * Math.PI / 180;

      cyl.valves.forEach((valve, v) => {
        const isIntake = v < 2;
        const phase = isIntake ? intakePhase : exhaustPhase;
        const duration = isIntake ? Math.PI * 1.3 : Math.PI * 1.4;
        const lift = valve.userData.maxLift;

        let valveLift = 0;
        const diff = (camAngle - phase + Math.PI * 4) % (Math.PI * 2) - Math.PI;
        if (Math.abs(diff) < duration / 2) {
          valveLift = lift * Math.sin(Math.PI * (diff + duration / 2) / duration) ** 2;
        }
        valve.position.y = this.geometry.deckHeight + stroke + 60 - valveLift;
        valve.userData.lift = valveLift;
      });
    });

    this.camshafts.forEach((bank, b) => {
      const sign = b === 0 ? -1 : 1;
      bank.intake.rotation.x = crankAngle / 2 + vvtIntake * Math.PI / 180;
      bank.exhaust.rotation.x = crankAngle / 2 + Math.PI + vvtExhaust * Math.PI / 180;
      bank.intake.rotation.z = sign * bankAngle;
      bank.exhaust.rotation.z = sign * bankAngle;
    });
  }

  getCylinderPhase(cylIndex: number): number {
    return this.crankAngles[cylIndex];
  }

  getFiringOrder(): number[] {
    return [...this.firingOrder];
  }
}

class CylinderAssembly {
  group: THREE.Group;
  piston!: THREE.Mesh;
  pin!: THREE.Mesh;
  rod!: THREE.Mesh;
  valves: THREE.Mesh[] = [];

  constructor(public index: number) {
    this.group = new THREE.Group();
    this.group.name = `Cylinder_${index + 1}`;
  }
}