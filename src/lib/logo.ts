import type { ImageSourcePropType } from 'react-native';
import type { AppTheme } from '../theme/theme';

const LOGO_BW = require('../../assets/logo-bw.png') as ImageSourcePropType;
const LOGO_INDIGO =
  require('../../assets/logo-indigo.png') as ImageSourcePropType;

/** eink: B&W logo. indigo: indigo logo. */
export function logoForTheme(theme: AppTheme): ImageSourcePropType {
  if (theme === 'indigo') {
    return LOGO_INDIGO;
  }
  return LOGO_BW;
}
