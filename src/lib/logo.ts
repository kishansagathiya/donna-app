import type { ImageSourcePropType } from 'react-native';
import type { AppTheme } from '../theme/theme';

const LOGO_BW = require('../../assets/logo-bw.png') as ImageSourcePropType;

/** App logo is always the black-and-white mark. */
export function logoForTheme(_theme: AppTheme): ImageSourcePropType {
  return LOGO_BW;
}
