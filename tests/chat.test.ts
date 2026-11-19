import {describe,expect,it} from 'vitest';
import {allowedCitations,fallbackAnswer,proposedAction} from '../lib/chat';

describe('chat trust boundaries',()=>{
  it('drops model-invented citations and duplicate links',()=>{
    const evidence=[{id:'official',title:'University source',url:'https://example.edu/call',status:'checked'}];
    expect(allowedCitations(['made-up','official','official'],evidence)).toEqual(evidence);
  });
  it('cannot turn a document quote into a task without an explicit user request',()=>{
    expect(proposedAction('Summarize my transcript',{kind:'task',title:'Send my passport',body:'',due_at:null})).toBeNull();
    expect(proposedAction('Add task: Upload confirmation',{kind:'task',title:'Upload confirmation',body:'',due_at:null})?.title).toBe('Upload confirmation');
  });
  it('does not assign an AI-guessed time to an official deadline task',()=>{
    const action=proposedAction('Remind me before the deadline',{kind:'task',title:'Check application',body:'',due_at:'2027-01-01T10:00:00Z'});
    expect(action?.due_at).toBeNull();
  });
  it('does not show past deadlines as upcoming when OpenAI is unavailable',()=>{
    const answer=fallbackAnswer('What deadlines are upcoming?',{applications:[],programmes:[],tasks:[],documents:[],scholarships:[],fundingPlans:[],deadlines:[{label:'Old deadline',date_local:'2020-01-01',status:'verified'}]});
    expect(answer).toContain('No verified upcoming deadlines');
  });
  it('keeps unknown funding fields unknown in the fallback',()=>{
    const answer=fallbackAnswer('Compare my funding options',{applications:[],programmes:[{id:'a',institution:'A University'}],tasks:[],documents:[],scholarships:[],deadlines:[],fundingPlans:[{programme_id:'a',currency:'EUR',tuition_per_year:0,living_per_month:null,stipend_per_month:null,initial_cash_required:null}]});
    expect(answer).toContain('tuition 0');expect(answer).toContain('living/month unknown');
  });
});
