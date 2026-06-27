/**
 * @format
 */

import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import appConfig from './app.json';

const appName = appConfig.name ?? appConfig.expo?.name ?? 'Donna';

AppRegistry.registerComponent(appName, () => App);
