import type { BodyPart, GoalInput, Unit, Weekday } from './types.ts';

export interface GoalTemplate {
  templateId: string;
  name: string;
  exercise: string;
  bodyPart: BodyPart;
  unit: Unit;
  target: number;
  weekdays: Weekday[];
  time: string;
}

export const TEMPLATES: GoalTemplate[] = [
  { templateId: 'morning-stretch', name: '아침 5분 스트레칭', exercise: '스트레칭', bodyPart: 'full', unit: 'min', target: 5, weekdays: [1, 2, 3, 4, 5], time: '07:00' },
  { templateId: 'after-work-lower', name: '퇴근 후 10분 하체', exercise: '하체 운동', bodyPart: 'lower', unit: 'min', target: 10, weekdays: [1, 3, 5], time: '19:30' },
  { templateId: 'lunch-1000', name: '점심 1000보', exercise: '걷기', bodyPart: 'cardio', unit: 'step', target: 1000, weekdays: [1, 3, 5], time: '12:30' },
  { templateId: 'squat-20', name: '스쿼트 20회', exercise: '스쿼트', bodyPart: 'lower', unit: 'rep', target: 20, weekdays: [1, 3, 5], time: '22:00' },
  { templateId: 'jumping-jack-30', name: '점핑잭 30회', exercise: '점핑잭', bodyPart: 'cardio', unit: 'rep', target: 30, weekdays: [2, 4], time: '20:00' },
  { templateId: 'plank-5', name: '플랭크 5분', exercise: '플랭크', bodyPart: 'core', unit: 'min', target: 5, weekdays: [1, 3, 5], time: '21:00' },
  { templateId: 'lunge-15', name: '런지 15회', exercise: '런지', bodyPart: 'lower', unit: 'rep', target: 15, weekdays: [2, 4], time: '21:00' },
  { templateId: 'pushup-10', name: '푸시업 10회', exercise: '푸시업', bodyPart: 'upper', unit: 'rep', target: 10, weekdays: [1, 4], time: '07:30' },
  { templateId: 'evening-core', name: '저녁 10분 코어', exercise: '코어 운동', bodyPart: 'core', unit: 'min', target: 10, weekdays: [2, 4, 6], time: '20:30' },
  { templateId: 'bedtime-stretch', name: '잠들기 전 5분 스트레칭', exercise: '스트레칭', bodyPart: 'full', unit: 'min', target: 5, weekdays: [1, 2, 3, 4, 5, 6, 0], time: '22:30' },
  { templateId: 'yoga-8', name: '요가 8분', exercise: '요가', bodyPart: 'full', unit: 'min', target: 8, weekdays: [6, 0], time: '09:00' },
];

export function templateToInput(t: GoalTemplate, durationWeeks: GoalInput['durationWeeks'] = 2): GoalInput {
  return {
    exercise: t.exercise,
    bodyPart: t.bodyPart,
    unit: t.unit,
    target: t.target,
    weekdays: t.weekdays,
    time: t.time,
    durationWeeks,
    templateId: t.templateId,
  };
}

export function getTemplate(id: string): GoalTemplate | undefined {
  return TEMPLATES.find((t) => t.templateId === id);
}

export const UNIT_LABEL: Record<Unit, string> = { rep: '회', min: '분', step: '보' };
export const BODY_PART_LABEL: Record<BodyPart, string> = {
  lower: '하체',
  upper: '상체',
  core: '코어',
  full: '전신',
  cardio: '유산소',
};
