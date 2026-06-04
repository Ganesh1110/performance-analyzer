class ConcurrentAnalyzer {
  analyzeConcurrentFeatures(reactCommits) {
    const analysis = {
      transitions: [],
      suspenseBoundaries: [],
      deferredUpdates: [],
      interruptedRenders: []
    };

    reactCommits.forEach(commit => {
      // Detect transitions (priority-based)
      if (commit.priorityLevel === 'Transition') {
        analysis.transitions.push({
          timestamp: Math.round(commit.timestamp),
          duration: commit.duration.toFixed(2),
          components: commit.components.map(c => c.name),
          wasInterrupted: (commit.interruptedDuration || 0) > 0
        });
      }

      // Detect interrupted renders (using interruptedDuration if available in profile)
      if (commit.interruptedDuration && commit.interruptedDuration > commit.duration * 0.5) {
        analysis.interruptedRenders.push({
          timestamp: Math.round(commit.timestamp),
          actualDuration: commit.duration.toFixed(2),
          interruptedDuration: commit.interruptedDuration.toFixed(2),
          efficiency: ((commit.duration / commit.interruptedDuration) * 100).toFixed(1),
          components: commit.components.map(c => c.name)
        });
      }
    });

    return analysis;
  }
}

module.exports = { ConcurrentAnalyzer };
