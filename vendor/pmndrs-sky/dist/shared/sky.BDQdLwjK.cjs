'use strict';

const react = require('react');

const SkyContext = react.createContext(null);
function useSky() {
  return react.useContext(SkyContext);
}

exports.SkyContext = SkyContext;
exports.useSky = useSky;
