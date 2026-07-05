// The following are the default window level presets and can be further
// configured via the customization service.
const defaultWindowLevelPresets = {
  CT: [
    { id: 'ct-abdomen', description: 'Abdomen', window: '350', level: '50' },
    { id: 'ct-pelvis', description: 'Pelvis', window: '400', level: '40' },
    { id: 'ct-acv-1', description: 'ACV 1', window: '8', level: '32' },
    { id: 'ct-acv-2', description: 'ACV 2', window: '50', level: '40' },
    { id: 'ct-cerebro', description: 'Cerebro', window: '80', level: '40' },
    { id: 'ct-huesos-temporales', description: 'Huesos temporales', window: '1800', level: '400' },
    { id: 'ct-huesos', description: 'Huesos', window: '2800', level: '600' },
    { id: 'ct-subdural-2', description: 'Subdural 2', window: '4000', level: '700' },
    { id: 'ct-tejido-blando-1', description: 'Tejido blando 1', window: '250', level: '50' },
    { id: 'ct-tejido-blando-2', description: 'Tejido blando 2', window: '400', level: '50' },
    { id: 'ct-pulmones', description: 'Pulmones', window: '1500', level: '-500' },
    { id: 'ct-mediastino', description: 'Mediastino', window: '350', level: '50' },
    { id: 'ct-higado', description: 'Hígado', window: '150', level: '30' },
  ],

  PT: [
    { id: 'pt-default', description: 'Predeterminado', window: '5', level: '2.5' },
    { id: 'pt-suv-3', description: 'SUV', window: '0', level: '3' },
    { id: 'pt-suv-5', description: 'SUV', window: '0', level: '5' },
    { id: 'pt-suv-7', description: 'SUV', window: '0', level: '7' },
    { id: 'pt-suv-8', description: 'SUV', window: '0', level: '8' },
    { id: 'pt-suv-10', description: 'SUV', window: '0', level: '10' },
    { id: 'pt-suv-15', description: 'SUV', window: '0', level: '15' },
  ],
};

export default defaultWindowLevelPresets;
