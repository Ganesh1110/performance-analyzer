class ConcurrentAnalyzer {
  analyzeConcurrentFeatures(reactCommits) {
    const analysis = {
      transitions:        [],
      suspenseBoundaries: [],
      deferredUpdates:    [],
      interruptedRenders: []
    };

    reactCommits.forEach(commit => {
      // Detect transitions (priority-based)
      if (commit.priorityLevel === 'Transition') {
        analysis.transitions.push({
          timestamp:     Math.round(commit.timestamp),
          duration:      commit.duration.toFixed(2),
          components:    commit.components.map(c => c.name),
          wasInterrupted: (commit.interruptedDuration || 0) > 0
        });
      }

      // Detect deferred updates (Idle/OffscreenLane = low priority work that can be deferred)
      if (commit.priorityLevel === 'Idle' || commit.priorityLevel === 'OffscreenLane') {
        analysis.deferredUpdates.push({
          timestamp:  Math.round(commit.timestamp),
          duration:   commit.duration.toFixed(2),
          components: commit.components.map(c => c.name)
        });
      }

      // Detect Suspense boundaries (components named 'Suspense' or containing 'Boundary')
      (commit.components || []).forEach(comp => {
        if (comp.name === 'Suspense' || comp.name.includes('Boundary')) {
          const alreadyTracked = analysis.suspenseBoundaries.find(s => s.name === comp.name);
          if (!alreadyTracked) {
            analysis.suspenseBoundaries.push({
              name:      comp.name,
              timestamp: Math.round(commit.timestamp)
            });
          }
        }
      });

      // Detect interrupted renders (using interruptedDuration if available in profile)
      if (commit.interruptedDuration && commit.interruptedDuration > commit.duration * 0.5) {
        analysis.interruptedRenders.push({
          timestamp:           Math.round(commit.timestamp),
          actualDuration:      commit.duration.toFixed(2),
          interruptedDuration: commit.interruptedDuration.toFixed(2),
          efficiency:          ((commit.duration / commit.interruptedDuration) * 100).toFixed(1),
          components:          commit.components.map(c => c.name)
        });
      }
    });

    return analysis;
  }
}

module.exports = { ConcurrentAnalyzer };
