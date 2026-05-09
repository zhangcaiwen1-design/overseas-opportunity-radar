import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { DailyOpportunityVideo } from './DailyOpportunityVideo';
import { VIDEO_COMPOSITION_ID } from './compositionId';

export const RemotionRoot = () => {
  return (
    <Composition
      id={VIDEO_COMPOSITION_ID}
      component={DailyOpportunityVideo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={1800}
      defaultProps={{ scenes: [] }}
    />
  );
};

registerRoot(RemotionRoot);
