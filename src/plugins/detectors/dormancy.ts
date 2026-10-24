import type { DetectorPlugin } from '../../core/types';
import { dormantDays } from '../../core/dates';

export const dormancyDetector: DetectorPlugin = {
  id: 'dormancy',
  name: '沉寂侦测器',
  version: '1.0.0',
  kind: 'detector',
  description: '按最近一次提交与沉寂天数识别项目；手动状态优先，归档项目默认入土。',
  classify(project, settings, now = new Date()) {
    if (project.manualStatus) return project.status;
    if (project.archived) return 'buried';
    const threshold =
      Number.isFinite(settings.dormantDays) && settings.dormantDays > 0 ? settings.dormantDays : 90;
    return dormantDays(project, now) >= threshold ? 'buried' : 'alive';
  },
};
