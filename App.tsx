import React from 'react';
import LiveSession from './components/LiveSession';

const App: React.FC = () => {
  // The API key is handled internally by LiveSession using process.env.API_KEY
  return <LiveSession />;
};

export default App;