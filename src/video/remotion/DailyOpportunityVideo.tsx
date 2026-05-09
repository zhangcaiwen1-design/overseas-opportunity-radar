import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import type { VideoScene } from '../../types';

const defaultScenes: VideoScene[] = [{ type: 'intro', title: '今日最值得看的海外机会' }];

function sceneLabel(type: VideoScene['type']) {
  if (type === 'intro') return '开场总论';
  if (type === 'outro') return '收尾总结';
  return '案例拆解';
}

export function DailyOpportunityVideo({ scenes }: { scenes: VideoScene[] }) {
  const { durationInFrames } = useVideoConfig();
  const activeScenes = scenes.length > 0 ? scenes : defaultScenes;
  const framesPerScene = Math.max(1, Math.floor(durationInFrames / activeScenes.length));

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a', color: '#ffffff', fontFamily: 'sans-serif' }}>
      {activeScenes.map((scene, index) => {
        const from = index * framesPerScene;
        const remainingFrames = durationInFrames - from;
        const sceneDuration = index === activeScenes.length - 1 ? remainingFrames : framesPerScene;

        return (
          <Sequence key={`${scene.type}-${scene.title}-${index}`} from={from} durationInFrames={sceneDuration}>
            <AbsoluteFill
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                padding: 64,
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 24, opacity: 0.72, margin: 0 }}>{sceneLabel(scene.type)}</p>
              <h1 style={{ fontSize: 72, lineHeight: 1.1, margin: '20px 0' }}>{scene.title}</h1>
              <p style={{ fontSize: 28, opacity: 0.8, margin: 0 }}>
                第 {index + 1} / {activeScenes.length} 段
              </p>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
