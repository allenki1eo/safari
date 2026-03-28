import { useRef, useEffect, useState, useCallback } from 'react';
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
import { clampLane, getLaneX, playAnimation, stopAnimation } from '../../utils/helpers';
import { CHARACTERS } from '../../utils/assetManifest';

const LANE_SWITCH_SPEED = 12; // units per second lateral movement

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
  const currentAnimRef = useRef('idle');
  const flashTimerRef = useRef(0);
  const cloneRef = useRef(null);

  const { gameState, takeDamage, isInvincible } = useGameStore.getState();

  // Clone scene for instancing safety
  useEffect(() => {
    cloneRef.current = scene.clone(true);
  }, [scene]);

  // Animation state machine
  const playAnim = useCallback((name, once = false) => {
    if (currentAnimRef.current === name) return;
    const prev = currentAnimRef.current;
    // Fade out previous
    if (actions[prev]) actions[prev].fadeOut(ANIMATION_CROSSFADE);
    // Fade in new
    const fallbacks = getFallbacks(name);
    const played = playAnimation(actions, name, fallbacks, ANIMATION_CROSSFADE);
    if (played) {
      currentAnimRef.current = name;
      if (once && actions[played]) {
        actions[played].setLoop(THREE.LoopOnce, 1);
        actions[played].clampWhenFinished = true;
      }
    }
  }, [actions]);

  // Start idle anim
  useEffect(() => {
    const t = setTimeout(() => playAnim('idle'), 200);
    return () => clearTimeout(t);
  }, [playAnim]);

  // Watch game state for anim transitions
  useEffect(() => {
    const unsub = useGameStore.subscribe(
      s => s.gameState,
      state => {
        if (state === 'playing') playAnim('run');
        if (state === 'menu') playAnim('idle');
        if (state === 'gameover') playAnim('hit', true);
      }
    );
    return unsub;
  }, [playAnim]);

  // Input handlers
  const handleLaneChange = useCallback((delta) => {
    const { gameState: gs } = useGameStore.getState();
    if (gs !== 'playing') return;
    const newLane = clampLane(laneRef.current + delta);
    if (newLane === laneRef.current) return;
    laneRef.current = newLane;
    targetXRef.current = getLaneX(newLane);
  }, []);

  const handleJump = useCallback(() => {
    const { gameState: gs } = useGameStore.getState();
    if (gs !== 'playing') return;
    if (isJumpingRef.current) return;
    isJumpingRef.current = true;
    yVelRef.current = JUMP_VELOCITY;
    isSlidingRef.current = false;
    slideTimerRef.current = 0;
    playAnim('jump', true);
  }, [playAnim]);

  const handleSlide = useCallback(() => {
    const { gameState: gs } = useGameStore.getState();
    if (gs !== 'playing') return;
    if (isJumpingRef.current) return;
    isSlidingRef.current = true;
    slideTimerRef.current = SLIDE_DURATION;
    playAnim('slide');
  }, [playAnim]);

  useInput({
    onLaneChange: handleLaneChange,
    onJump: handleJump,
    onSlide: handleSlide,
    enabled: true,
  });

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    const { gameState: gs, isInvincible: inv } = useGameStore.getState();

    // Lateral movement (lane switching)
    const dx = targetXRef.current - currentXRef.current;
    if (Math.abs(dx) > 0.01) {
      currentXRef.current += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SWITCH_SPEED * dt);
    } else {
      currentXRef.current = targetXRef.current;
    }

    // Vertical movement (jump/gravity)
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

    // Apply position
    groupRef.current.position.x = currentXRef.current;
    groupRef.current.position.y = yPosRef.current;

    // Slide scale (shrink height)
    const targetScaleY = isSlidingRef.current ? SLIDE_HEIGHT / PLAYER_HEIGHT : 1;
    groupRef.current.scale.y = THREE.MathUtils.lerp(groupRef.current.scale.y, targetScaleY, 0.2);

    // Invincibility flash
    if (inv) {
      flashTimerRef.current += dt;
      const visible = Math.sin(flashTimerRef.current * 20) > 0;
      groupRef.current.visible = visible;
    } else {
      groupRef.current.visible = true;
      flashTimerRef.current = 0;
    }

    // Update animation mixer
    mixer?.update(dt);
  });

  // Expose refs for collision detection
  Runner.getCurrentX = () => currentXRef.current;
  Runner.getCurrentY = () => yPosRef.current;
  Runner.isSliding = () => isSlidingRef.current;
  Runner.laneIndex = () => laneRef.current;

  return (
    <group ref={groupRef} position={[getLaneX(LANE_CENTER), GROUND_Y, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function getFallbacks(animName) {
  const map = {
    run: ['Run', 'Running', 'Walk', 'Walking', 'run_forward'],
    jump: ['Jump', 'jumping', 'Jump_Start'],
    slide: ['Slide', 'sliding', 'Crouch', 'crouch'],
    hit: ['Hit', 'Death', 'death', 'Fall', 'fall', 'hurt'],
    idle: ['Idle', 'idle_loop', 'T-Pose', 'TPose'],
    celebrate: ['Celebrate', 'Victory', 'Dance', 'wave'],
  };
  return map[animName] || [];
}

export default Runner;
