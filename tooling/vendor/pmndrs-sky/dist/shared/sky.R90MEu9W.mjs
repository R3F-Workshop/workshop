import { createContext, useContext } from 'react';

const SkyContext = createContext(null);
function useSky() {
  return useContext(SkyContext);
}

export { SkyContext as S, useSky as u };
