import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { useInput } from '../../hooks/useInput';
import {
  LANES, LANE_CENTER, JUMP_VELOCITY, GRAVITY, GROUND_Y,
  SLIDE_DURATION, PLAYER_HEIGHT, PLAYER_RADIUS, SLIDE_HEIGHT,
  ANIMATION_CROSSFADE,
} from '../../utils/constants';
import { clampLane, getLaneX } from '../../utils/helpers';

const LANE_SWITCH_SPEED = 14;

function Runner({ modelPath }) {
  const { scene, animations } = useGLTF(modelPath);
  const groupRef = useRef();
  const { actions, mixer } = useAnimations(animations, groupRef);

  const laneRef = useRef(LANE_CENTER);
  const targetXRef = useRef(getLaneX(LANE_CENTER));
  const currentXRef = useRef(getLaneX(LANE_CENTER));
  const yVelRef = useRef(0);
  const yPosRef = useRef(GROUND_Y);
  const isJumpingRef = useRef(false);
  const isSlidingRef = useRef(false);
  const slideTimerRef = useRef(0);
  const currentAnimRef = useRef('');
  const flashTimerRef = useRef(0);
  const scaledRef = useRef(false);

  const gameState = useGameStore(s => s.gameState);

  const playAnim = useCallback((name, once = false) => {
    if (!actions) return;
    const FALLBACKS = {
      run:       ['Run', 'Running', 'Walk', 'Walking', 'run_forward', 'CharacterArmature|Run'],
      jump:      ['Jump', 'jumping', 'Jump_Start', 'CharacterArmature|Jump'],
      slide:     ['Slide', 'Crouch', 'crouch', 'CharacterArmature|Duck'],
      hit:       ['Hit', 'Death', 'death', 'Fall', 'CharacterArmature|Death'],
      idle:      ['Idle', 'idle_loop', 'T-Pose', 'CharacterArmature|Idle'],
      celebrate: ['Celebrate', 'Victory', 'Dance', 'Wave'],
    };
    const candidates = [name, ...(FALLBACKS[name] || [])];
    let target = candidates.find(n => actions[n]);
    if (!target) target = Object.keys(actions)[0];
    if (!target) return;
    if (currentAnimRef.current === target) return;

    // Fade out previous
    if (currentAnimRef.current && actions[currentAnimRef.current]) {
      actions[currentAnimRef.current].fadeOut(ANIMATION_CROSSFADE);
    }
    const a = actions[target].reset().fadeIn(ANIMATION_CROSSFADE);
    if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    a.play();
    currentAnimRef.current = target;
  }, [actions]);

  // Game state → animation transition
  useEffect(() => {
    if (gameState === 'playing') playAnim('run');
    else if (gameState === 'menu' || gameState === 'character_select') playAnim('idle');
    else if (gameState === 'gameover') playAnim('hit', true);
  }, [gameState, playAnim]);

  // Start idle on mount once actions are ready
  useEffect(() => {
    const t = setTimeout(() => playAnim('idle'), 200);
    return () => clearTimeout(t);
  }, [actions]);

  // Auto-scale model to PLAYER_HEIGHT once
  useEffect(() => {
    if (scaledRef.current || !groupRef.current) return;
    const box = new THREE.Box3().setFromObject(groupRef.current);
    const height = box.max.y - box.min.y;
    if (height > 0.01) {
      const s = PLAYER_HEIGHT / height;
      groupRef.current.scale.setScalar(s);
      // Align feet to ground
      const feetOffset = box.min.y * s;
      groupRef.current.userData.feetOffset = feetOffset;
      scaledRef.current = true;
    }
  });

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
    playAnim('jump', true);
  }, [playAnim]);

  const handleSlide = useCallback(() => {
    if (useGameStore.getState().gameState !== 'playing') return;
    if (isJumpingRef.current) return;
    isSlidingRef.current = true;
    slideTimerRef.current = SLIDE_DURATION;
    playAnim('slide');
  }, [playAnim]);

  useInput({ onLaneChange: handleLaneChange, onJump: handleJump, onSlide: handleSlide });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const { gameState: gs, isInvincible: inv } = useGameStore.getState();

    // Lateral movement
    const dx = targetXRef.current - currentXRef.current;
    if (Math.abs(dx) > 0.01) {
      currentXRef.current += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SWITCH_SPEED * dt);
    } else {
      currentXRef.current = targetXRef.current;
    }

    // Jump physics
    if (isJumpingRef.current) {
      yVelRef.current += GRAVITY * dt;
      yPosRef.current += yVelRef.current * dt;
      if (yPosRef.current <= GROUND_Y) {
        yPosRef.current = GROUND_Y;
        yVelRef.current = 0;
        isJumpingRef.current = false;
        if (gs === 'playing') {
          if (isSlidingRef.current) playAnim('slide');
          else playAnim('run');
        }
      }
    }

    // Slide timer
    if (isSlidingRef.current) {
      slideTimerRef.current -= dt;
      if (slideTimerRef.current <= 0) {
        isSlidingRef.current = false;
        if (gs === 'playing' && !isJumpingRef.current) playAnim('run');
      }
    }

    // Expose runner X for collision detection (read by ObstacleManager)
    window.__runnerX = currentXRef.current;

    // Apply position — y offset to keep feet on ground
    const feetOffset = groupRef.current.userData.feetOffset || 0;
    groupRef.current.position.x = currentXRef.current;
    groupRef.current.position.y = yPosRef.current - feetOffset;

    // Slide squish on Y
    const targetSY = isSlidingRef.current ? 0.5 : 1;
    groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetSY, 0.15);

    // Invincibility flash
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
      {/* Rotate 180° so the character faces forward (toward -Z) */}
      <primitive object={scene} rotation={[0, Math.PI, 0]} />
      {/* Shadow blob under player */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>
    </group>
  );
}

export default Runner;
