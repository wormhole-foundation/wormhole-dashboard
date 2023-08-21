import { Tab, Tabs } from '@mui/material';
import React from 'react';

function Metrics() {
  const [value, setValue] = React.useState(0);
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };
  return (
    <>
      <Tabs value={value} onChange={handleChange} centered sx={{ minHeight: 36 }}>
        <Tab label="7 Day" sx={{ minHeight: 36, py: 0 }} />
        <Tab label="30 Day" sx={{ minHeight: 36, py: 0 }} />
      </Tabs>
      {value === 0 ? (
        <iframe
          title="7 Day Report"
          src="https://lookerstudio.google.com/embed/reporting/d2236e5e-bf1b-4bff-9a5c-f9a394fdeb68/page/p_o3mrmt3o8c"
          style={{ border: 0, height: 'calc( 100vh - 92px )', width: '100%' }}
          allowFullScreen
        ></iframe>
      ) : (
        <iframe
          title="30 Day Report"
          src="https://lookerstudio.google.com/embed/reporting/8a014f09-2954-4437-ac46-3d83f20fe6df/page/p_o3mrmt3o8c"
          style={{ border: 0, height: 'calc( 100vh - 92px )', width: '100%' }}
          allowFullScreen
        ></iframe>
      )}
    </>
  );
}
export default Metrics;
