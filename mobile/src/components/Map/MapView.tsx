// Platform map shim — native (Android/iOS) path.
// Metro resolves MapView.web.tsx on web instead of this file; TypeScript resolves
// this base file. react-native-maps has no web support (its Fabric codegen —
// codegenNativeComponent — is undefined under react-native-web and crashes at import),
// so web gets a stub via MapView.web.tsx.
import MapView, { Marker } from 'react-native-maps';

export type { Region } from 'react-native-maps';
export { Marker };
export default MapView;
