import {describe,it,expect} from 'vitest';
import {deadlineInstant,displayDeadline,isOfficialUrl,reminderKey,sourceChangeKey} from '../lib/domain';
import {approvedOfficialHost} from '../lib/monitor';

describe('deadline integrity',()=>{
  it('does not synthesize a clock time for date-only evidence',()=>{
    const item={date_local:'2027-01-31',time_local:null,timezone:null};
    expect(deadlineInstant(item)).toBeNull();
    expect(displayDeadline(item).local).toContain('closing time unknown');
    expect(displayDeadline(item).ist).toBe('IST conversion unavailable');
  });
  it('converts official local times across daylight saving transitions',()=>{
    expect(deadlineInstant({date_local:'2027-01-15',time_local:'17:00',timezone:'Europe/Berlin'})?.toISOString()).toBe('2027-01-15T16:00:00.000Z');
    expect(deadlineInstant({date_local:'2027-07-15',time_local:'17:00',timezone:'Europe/Berlin'})?.toISOString()).toBe('2027-07-15T15:00:00.000Z');
  });
  it('refuses nonexistent or ambiguous daylight saving clock times',()=>{
    expect(()=>deadlineInstant({date_local:'2027-03-28',time_local:'02:30',timezone:'Europe/Berlin'})).toThrow();
    expect(()=>deadlineInstant({date_local:'2027-10-31',time_local:'02:30',timezone:'Europe/Berlin'})).toThrow();
  });
  it('deduplicates alerts by source snapshot and reminder point',()=>{
    expect(sourceChangeKey('source-id','hash-a')).toBe(sourceChangeKey('source-id','hash-a'));
    expect(sourceChangeKey('source-id','hash-a')).not.toBe(sourceChangeKey('source-id','hash-b'));
    expect(reminderKey('deadline-id','7d')).not.toBe(reminderKey('deadline-id','3d'));
  });
});
describe('automated source boundary',()=>{
  it('rejects local and credentialed URLs',()=>{
    expect(isOfficialUrl('https://localhost/internal')).toBe(false);
    expect(isOfficialUrl('https://127.0.0.1/admin')).toBe(false);
    expect(isOfficialUrl('https://user:pass@uni-passau.de/')).toBe(false);
    expect(isOfficialUrl('http://uni-passau.de/')).toBe(false);
  });
  it('allows known official hosts but not lookalikes',()=>{
    expect(approvedOfficialHost('www.uni-passau.de')).toBe(true);
    expect(approvedOfficialHost('uni-passau.de.evil.example')).toBe(false);
    expect(approvedOfficialHost('example.org')).toBe(false);
  });
});
