class PhaseAnalyzer {
  analyzeRenderPhases(reactCommits) {
    return reactCommits.map(commit => {
      // React DevTools provides effectDuration (commit phase)
      const renderPhaseTime = commit.duration - (commit.effectDuration || 0);
      const commitPhaseTime = commit.effectDuration || 0;

      return {
        timestamp: Math.round(commit.timestamp),
        totalDuration: commit.duration.toFixed(2),
        renderPhase: {
          duration: renderPhaseTime.toFixed(2),
          percentage: ((renderPhaseTime / commit.duration) * 100).toFixed(1),
          expensive: renderPhaseTime > 10 // 10ms threshold
        },
        commitPhase: {
          duration: commitPhaseTime.toFixed(2),
          percentage: ((commitPhaseTime / commit.duration) * 100).toFixed(1),
          expensive: commitPhaseTime > 5 // Effects should be fast
        },
        recommendation: this.getPhaseRecommendation(renderPhaseTime, commitPhaseTime)
      };
    });
  }

  getPhaseRecommendation(renderTime, commitTime) {
    if (renderTime > 10 && commitTime < 2) {
      return 'Render phase slow. Use useMemo() for logic.';
    }
    if (commitTime > 5) {
      return 'Commit phase (Effects) slow. Check useEffect hooks.';
    }
    if (renderTime > 10 && commitTime > 5) {
      return 'Both phases heavy. Consider component splitting.';
    }
    return 'Healthy render cycle.';
  }
}

module.exports = { PhaseAnalyzer };
