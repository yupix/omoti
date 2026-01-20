import { Composition } from 'remotion';
import { ResultVideo } from './ResultVideo';
import { Clip } from '../types';

export const MyComposition = () => {
    return (
        <Composition
            id="MainVideo"
            component={ResultVideo}
            durationInFrames={300}
            fps={30}
            width={1280}
            height={720}
            defaultProps={{
                clips: [] as Clip[],
                primaryColor: '#6d28d9',
            }}
        />
    );
};
