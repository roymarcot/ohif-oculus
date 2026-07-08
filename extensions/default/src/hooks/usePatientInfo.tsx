import { useState, useEffect } from 'react';
import moment from 'moment';
import { utils, useSystem } from '@ohif/core';

const { formatPN, formatDate } = utils;

const calculatePatientAge = (instance: Record<string, unknown>): string | null => {
  if (instance.PatientAge) {
    return instance.PatientAge as string;
  }

  if (!instance.PatientBirthDate) {
    return null;
  }

  const birthDate = moment(instance.PatientBirthDate as string, ['YYYYMMDD', 'YYYY.MM.DD'], true);
  const referenceDate = instance.StudyDate
    ? moment(instance.StudyDate as string, ['YYYYMMDD', 'YYYY.MM.DD'], true)
    : moment();

  if (!birthDate.isValid() || !referenceDate.isValid()) {
    return null;
  }

  const ageInMonths = referenceDate.diff(birthDate, 'months');

  if (ageInMonths < 1) {
    const ageInDays = referenceDate.diff(birthDate, 'days');
    return `${String(ageInDays).padStart(3, '0')}D`;
  }

  if (ageInMonths < 24) {
    return `${String(ageInMonths).padStart(3, '0')}M`;
  }

  const ageInYears = referenceDate.diff(birthDate, 'years');
  return `${String(ageInYears).padStart(3, '0')}Y`;
};

function usePatientInfo() {
  const { servicesManager } = useSystem();
  const { displaySetService } = servicesManager.services;

  const [patientInfo, setPatientInfo] = useState({
    PatientName: '',
    PatientID: '',
    PatientSex: '',
    PatientDOB: '',
    PatientAge: '',
  });
  const [isMixedPatients, setIsMixedPatients] = useState(false);

  const checkMixedPatients = (PatientID: string) => {
    const displaySets = displaySetService.getActiveDisplaySets();
    let isMixedPatients = false;
    displaySets.forEach(displaySet => {
      const instance = displaySet?.instances?.[0] || displaySet?.instance;
      if (!instance) {
        return;
      }
      if (instance.PatientID !== PatientID) {
        isMixedPatients = true;
      }
    });
    setIsMixedPatients(isMixedPatients);
  };

  const updatePatientInfo = ({ displaySetsAdded }) => {
    if (!displaySetsAdded.length) {
      return;
    }
    const displaySet = displaySetsAdded[0];
    const instance = displaySet?.instances?.[0] || displaySet?.instance;
    if (!instance) {
      return;
    }

    setPatientInfo({
      PatientID: instance.PatientID || null,
      PatientName: instance.PatientName ? formatPN(instance.PatientName) : null,
      PatientSex: instance.PatientSex || null,
      PatientDOB: formatDate(instance.PatientBirthDate) || null,
      PatientAge: calculatePatientAge(instance) || null,
    });
    checkMixedPatients(instance.PatientID || null);
  };

  useEffect(() => {
    const subscription = displaySetService.subscribe(
      displaySetService.EVENTS.DISPLAY_SETS_ADDED,
      props => updatePatientInfo(props)
    );
    return () => subscription.unsubscribe();
  }, []);

  return { patientInfo, isMixedPatients };
}

export default usePatientInfo;
