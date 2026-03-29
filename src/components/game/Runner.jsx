import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { useInput } from '../../hooks/useInput';
import {
  LANES, LANE_CENTER, JUMP_VELOCITY, GRAVITY, GROUND_Y,
  SLIDE_DURATION, PLAYER_HEIGHT, PLAYER_RADIUS,
  ANIMATION_CROSSFADE,
} from '../../utils/constants';
import { clampLane, getLaneX } from '../../utils/helpers';

const LANE_SWITCH_SPEED = 14;
const FALL_MULTIPLIER   = 2.0;   // faster descent for snappy feel

function Runner({ modelPath }) {
  const { scene, animations } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // groupRef = position/visibility only (not scaled)
  // modelRef = the 3-D model (scaled + squished)
  const groupRef  = useRef();
  const modelRef  = useRef();
  const { actions, mixer } = useAnimations(animations, modelRef);

  const laneRef        = useRef(LANE_CENTER);
  const targetXRef     = useRef(getLaneX(LANE_CENTER));
  const currentXRef    = useRef(getLaneX(LANE_CENTER));
  const yVelRef        = useRef(0);
  const yPosRef        = useRef(GROUND_Y);
  const isJumpingRef   = useRef(false);
  const isSlidingRef   = useRef(false);
  const slideTimerRef  = useRef(0);
  const currentAnimRef = useRef('');
  const flashTimerRef  = useRef(0);
  const scaledRef      = useRef(false);
  const autoScaleRef   = useRef(1);
  const frameRef       = useRef(0);

  const gameState = useGameStore(s => s.gameState);

  // ── Animation helper ──────────────────────────────────────────────────────
  const playAnim = useCallback((name, once = false) => {
    if (!actions) return;
    const FALLBACKS = {
      run:   ['Run', 'Running', 'Walk', 'Walking', 'run_forward',
              'CharacterArmature|Run'],
      jump:  ['Jump', 'Jump_Start', 'jumping', 'Jump_Idle',
              'CharacterArmature|Jump'],
      slide: ['Slide', 'Roll', 'Crouch', 'crouch', 'Duck',
              'CharacterArmature|Duck', 'CharacterArmature|Roll'],
      hit:   ['Hit', 'HitRecieve', 'Death', 'death', 'Fall',
              'CharacterArmature|Death'],
      idle:  ['Idle', 'idle_loop', 'T-Pose',
              'CharacterArmature|Idle'],
    };
    const candidates = [name, ...(FALLBACKS[name] || [])];
    let target = candidates.find(n => actions[n]);
    if (!target) target = Object.keys(actions)[0];
    if (!target || currentAnimRef.current === target) return;

    if (currentAnimRef.current && actions[currentAnimRef.current]) {
      actions[currentAnimRef.current].fadeOut(ANIMATION_CROSSFADE);
    }
    const a = actions[target].reset().fadeIn(ANIMATION_CROSSFADE);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    else      { a.setLoop(THREE.LoopRepeat, Infinity); }
    a.play();
    currentAnimRef.current = target;
  }, [actions]);

  // ── Game-state → animation ────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'playing') playAnim('run');
    else if (gameState === 'menu' || gameState === 'character_select') playAnim('idle');
    else if (gameState === 'gameover') playAnim('hit', true);
  }, [gameState, playAnim]);

  useEffect(() => {
    const t = setTimeout(() => playAnim('idle'), 250);
    return () => clearTimeout(t);
  }, [actions]);

  // ── Input handlers ────────────────────────────────────────────────────────
  const handleLaneChange = useCallback((delta) => {
    if (useGameStore.getState().gameState !== 'playing') return;
    const newLane = clampLane(laneRef.current + delta);
    if (newLane === laneRef.current) return;
    laneRef.current = newLane;
    targetXRef.current = getLaneX(newLane);
  }, []);

  const handleJump = useCallback(() => {
    if (useGameStore.getState().gameState !== 'playing') return;
    if (isJumpingRef.current) return;
    isJumpingRef.current = true;
    yVelRef.current = JUMP_VELOCITY;
    isSlidingRef.current = false;
    slideTimerRef.current = 0;
    playAnim('jump');
  }, [playAnim]);

  const handleSlide = useCallback(() => {
    if (useGameStore.getState().gameState !== 'playing') return;
    if (isJumpingRef.current) return;
    isSlidingRef.current = true;
    slideTimerRef.current = SLIDE_DURATION;
    playAnim('slide');
  }, [playAnim]);

  useInput({ onLaneChange: handleLaneChange, onJump: handleJump, onSlide: handleSlide });

  // ── Per-frame logic ───────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (!groupRef.current || !modelRef.current) return;
    const dt = Math.min(delta, 0.1);
    const { gameState: gs, isInvincible: inv } = useGameStore.getState();
    frameRef.current++;

    // ── Auto-scale (on modelRef only — excludes shadow mesh) ──────────────
    if (!scaledRef.current && frameRef.current >= 3) {
      modelRef.current.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const h = box.max.y - box.min.y;

      if (isFinite(h) && h > 0.05) {
        const s = PLAYER_HEIGHT / h;
        modelRef.current.scale.setScalar(s);

        // Recompute box at new scale for feet placement
        modelRef.current.updateMatrixWorld(true);
        const newBox = new THREE.Box3().setFromObject(modelRef.current);
        if (isFinite(newBox.min.y)) {
          modelRef.current.position.y = -newBox.min.y;
        }
        autoScaleRef.current = s;
        scaledRef.current = true;
      }
    }

    // ── Lateral movement ──────────────────────────────────────────────────
    const dx = targetXRef.current - currentXRef.current;
    if (Math.abs(dx) > 0.01) {
      currentXRef.current += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SWITCH_SPEED * dt);
    } else {
      currentXRef.current = targetXRef.current;
    }

    // ── Jump physics (fast-fall on descent) ───────────────────────────────
    if (isJumpingRef.current) {
      const g = yVelRef.current < 0 ? GRAVITY * FALL_MULTIPLIER : GRAVITY;
      yVelRef.current += g * dt;
      yPosRef.current += yVelRef.current * dt;
      if (yPosRef.current <= GROUND_Y) {
        yPosRef.current = GROUND_Y;
        yVelRef.current = 0;
        isJumpingRef.current = false;
        if (gs === 'playing') {
          playAnim(isSlidingRef.current ? 'slide' : 'run');
        }
      }
    }

    // ── Slide timer ───────────────────────────────────────────────────────
    if (isSlidingRef.current) {
      slideTimerRef.current -= dt;
      if (slideTimerRef.current <= 0) {
        isSlidingRef.current = false;
        if (gs === 'playing' && !isJumpingRef.current) playAnim('run');
      }
    }

    // ── Expose runner position for collision + camera ─────────────────────
    window.__runnerX = currentXRef.current;
    window.__runnerY = yPosRef.current;

    // ── Apply position to groupRef (positioning wrapper) ──────────────────
    groupRef.current.position.x = currentXRef.current;
    groupRef.current.position.y = yPosRef.current;

    // ── Slide squish on modelRef (not groupRef, to keep shadow stable) ────
    if (scaledRef.current) {
      const base = autoScaleRef.current;
      const targetSY = isSlidingRef.current ? base * 0.5 : base;
      modelRef.current.scale.y = THREE.MathUtils.lerp(
        modelRef.current.scale.y, targetSY, 0.2
      );
    }

    // ── Invincibility flash ───────────────────────────────────────────────
    if (inv) {
      flashTimerRef.current += dt;
      groupRef.current.visible = Math.sin(flashTimerRef.current * 20) > 0;
    } else {
      groupRef.current.visible = true;
      flashTimerRef.current = 0;
    }

    mixer?.update(dt);
  });

  return (
    <group ref={groupRef} position={[getLaneX(LANE_CENTER), GROUND_Y, 0]}>
      {/* Model group — scaled independently from shadow */}
      <group ref={modelRef}>
        <primitive object={clonedScene} rotation={[0, Math.PI, 0]} />
      </group>
      {/* Shadow blob — stays at fixed size */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default Runner;
