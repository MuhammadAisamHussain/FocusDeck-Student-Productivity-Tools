(function () {
  'use strict';

  // TAB SWITCHING
  var allTabs = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.tool-panel');
  var mobileTabBtn = document.querySelector('.mobile-tab-btn');
  var mobileTabs = document.querySelector('.mobile-tabs');

  function switchTool(toolId) {
    for (var p = 0; p < panels.length; p++) panels[p].classList.remove('active');
    for (var t = 0; t < allTabs.length; t++) allTabs[t].classList.remove('active');

    var panel = document.getElementById(toolId);
    if (panel) {
      panel.classList.add('active');
      var inner = panel.querySelector('.tool-inner');
      if (inner) { inner.style.animation = 'none'; inner.offsetHeight; inner.style.animation = ''; }
    }

    for (var a = 0; a < allTabs.length; a++) {
      if (allTabs[a].dataset.tool === toolId) allTabs[a].classList.add('active');
    }

    if (mobileTabs) mobileTabs.classList.remove('open');
  }

  for (var ti = 0; ti < allTabs.length; ti++) {
    allTabs[ti].addEventListener('click', function () { switchTool(this.dataset.tool); });
  }

  if (mobileTabBtn) {
    mobileTabBtn.addEventListener('click', function () { mobileTabs.classList.toggle('open'); });
  }

  // ==================
  // GPA CALCULATOR
  // ==================
  var gradeValues = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  };

  var coursesList = document.getElementById('coursesList');
  var addCourseBtn = document.getElementById('addCourse');
  var gpaResult = document.getElementById('gpaResult');
  var gpaFill = document.getElementById('gpaFill');

  function addCourseRow(name, credits, grade) {
    var row = document.createElement('div');
    row.className = 'course-row';

    var gradeOptions = '';
    var grades = Object.keys(gradeValues);
    for (var g = 0; g < grades.length; g++) {
      var sel = grades[g] === grade ? ' selected' : '';
      gradeOptions += '<option value="' + grades[g] + '"' + sel + '>' + grades[g] + '</option>';
    }

    row.innerHTML =
      '<input type="text" placeholder="Course name" value="' + (name || '') + '" class="course-name">' +
      '<input type="number" min="1" max="6" value="' + (credits || 3) + '" class="course-credits">' +
      '<select class="course-grade">' + gradeOptions + '</select>' +
      '<button class="remove-btn" title="Remove">&times;</button>';

    row.querySelector('.remove-btn').addEventListener('click', function () {
      row.style.opacity = '0';
      row.style.transform = 'translateX(16px)';
      row.style.transition = 'all 0.25s';
      setTimeout(function () { row.remove(); calculateGPA(); saveCourses(); }, 250);
    });

    var inputs = row.querySelectorAll('input, select');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('change', function () { calculateGPA(); saveCourses(); });
      inputs[i].addEventListener('input', function () { calculateGPA(); saveCourses(); });
    }

    coursesList.appendChild(row);
    calculateGPA();
  }

  function calculateGPA() {
    var rows = coursesList.querySelectorAll('.course-row');
    var totalPoints = 0;
    var totalCredits = 0;

    for (var r = 0; r < rows.length; r++) {
      var cr = parseFloat(rows[r].querySelector('.course-credits').value) || 0;
      var gr = rows[r].querySelector('.course-grade').value;
      var pts = gradeValues[gr] !== undefined ? gradeValues[gr] : 0;
      totalPoints += pts * cr;
      totalCredits += cr;
    }

    var gpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
    gpaResult.textContent = gpa.toFixed(2);
    gpaFill.style.width = (gpa / 4 * 100) + '%';

    if (gpa >= 3.5) gpaFill.style.background = '#27ae60';
    else if (gpa >= 2.5) gpaFill.style.background = '#4a7c9b';
    else if (gpa >= 1.5) gpaFill.style.background = '#f39c12';
    else gpaFill.style.background = '#c0392b';
  }

  function saveCourses() {
    var rows = coursesList.querySelectorAll('.course-row');
    var data = [];
    for (var r = 0; r < rows.length; r++) {
      data.push({
        name: rows[r].querySelector('.course-name').value,
        credits: rows[r].querySelector('.course-credits').value,
        grade: rows[r].querySelector('.course-grade').value
      });
    }
    try { localStorage.setItem('focusdeck_courses', JSON.stringify(data)); } catch (e) {}
  }

  function loadCourses() {
    try {
      var data = JSON.parse(localStorage.getItem('focusdeck_courses'));
      if (data && data.length > 0) {
        for (var i = 0; i < data.length; i++) addCourseRow(data[i].name, data[i].credits, data[i].grade);
      } else {
        addCourseRow('', 3, 'A');
        addCourseRow('', 3, 'B+');
        addCourseRow('', 4, 'A-');
      }
    } catch (e) {
      addCourseRow('', 3, 'A');
      addCourseRow('', 3, 'B+');
      addCourseRow('', 4, 'A-');
    }
  }

  addCourseBtn.addEventListener('click', function () { addCourseRow('', 3, 'A'); saveCourses(); });
  loadCourses();

  // ==================
  // STUDY PLANNER
  // ==================
  var sessions = [];
  var sessionIdCounter = 0;

  function loadSessions() {
    try {
      var data = JSON.parse(localStorage.getItem('focusdeck_sessions'));
      if (data) {
        sessions = data;
        var maxId = 0;
        for (var i = 0; i < sessions.length; i++) { if (sessions[i].id > maxId) maxId = sessions[i].id; }
        sessionIdCounter = maxId + 1;
      }
    } catch (e) {}
    renderSessions();
  }

  function saveSessions() {
    try { localStorage.setItem('focusdeck_sessions', JSON.stringify(sessions)); } catch (e) {}
  }

  function renderSessions() {
    var slots = document.querySelectorAll('.day-slots');
    for (var s = 0; s < slots.length; s++) slots[s].innerHTML = '';

    var totalH = 0;
    for (var i = 0; i < sessions.length; i++) {
      var ses = sessions[i];
      totalH += parseFloat(ses.duration);
      var dayCol = document.querySelector('.day-col[data-day="' + ses.day + '"] .day-slots');
      if (!dayCol) continue;

      var block = document.createElement('div');
      block.className = 'session-block';
      var durText = ses.duration + (parseFloat(ses.duration) === 1 ? ' hr' : ' hrs');
      block.innerHTML =
        '<div class="sb-subject">' + escapeHTML(ses.subject) + '</div>' +
        '<div class="sb-time">' + ses.time + ' (' + durText + ')</div>' +
        '<button class="sb-remove" title="Remove">&times;</button>';

      (function (id) {
        block.querySelector('.sb-remove').addEventListener('click', function () {
          sessions = sessions.filter(function (x) { return x.id !== id; });
          saveSessions();
          renderSessions();
        });
      })(ses.id);

      dayCol.appendChild(block);
    }

    document.getElementById('totalHours').textContent = totalH;
    document.getElementById('totalSessions').textContent = sessions.length;
  }

  document.getElementById('addSession').addEventListener('click', function () {
    var subject = document.getElementById('sessionSubject').value.trim();
    if (!subject) { document.getElementById('sessionSubject').focus(); return; }

    sessions.push({
      id: sessionIdCounter++,
      subject: subject,
      day: document.getElementById('sessionDay').value,
      time: document.getElementById('sessionTime').value,
      duration: parseFloat(document.getElementById('sessionDuration').value)
    });

    document.getElementById('sessionSubject').value = '';
    saveSessions();
    renderSessions();
  });

  loadSessions();

  // ==================
  // DEADLINE TRACKER
  // ==================
  var deadlines = [];
  var dlIdCounter = 0;

  function loadDeadlines() {
    try {
      var data = JSON.parse(localStorage.getItem('focusdeck_deadlines'));
      if (data) {
        deadlines = data;
        var maxId = 0;
        for (var i = 0; i < deadlines.length; i++) { if (deadlines[i].id > maxId) maxId = deadlines[i].id; }
        dlIdCounter = maxId + 1;
      }
    } catch (e) {}
    renderDeadlines();
  }

  function saveDeadlines() {
    try { localStorage.setItem('focusdeck_deadlines', JSON.stringify(deadlines)); } catch (e) {}
  }

  function renderDeadlines() {
    var list = document.getElementById('deadlineList');
    var empty = document.getElementById('emptyDeadlines');
    list.innerHTML = '';

    if (deadlines.length === 0) {
      empty.classList.remove('hidden');
      document.getElementById('dueThisWeek').textContent = '0';
      document.getElementById('overdue').textContent = '0';
      return;
    }
    empty.classList.add('hidden');

    var sorted = deadlines.slice().sort(function (a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.date) - new Date(b.date);
    });

    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var dueCount = 0;
    var overdueCount = 0;

    for (var i = 0; i < sorted.length; i++) {
      var dl = sorted[i];
      var dueDate = new Date(dl.date + 'T00:00:00');
      var diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

      if (!dl.completed && diffDays < 0) overdueCount++;
      if (!dl.completed && diffDays >= 0 && diffDays <= 7) dueCount++;

      var daysText = '';
      var daysClass = '';
      if (dl.completed) { daysText = 'Done'; }
      else if (diffDays < 0) { daysText = Math.abs(diffDays) + 'd overdue'; daysClass = 'overdue'; }
      else if (diffDays === 0) { daysText = 'Due today'; daysClass = 'soon'; }
      else if (diffDays === 1) { daysText = 'Tomorrow'; daysClass = 'soon'; }
      else if (diffDays <= 3) { daysText = diffDays + ' days'; daysClass = 'soon'; }
      else { daysText = diffDays + ' days'; }

      var item = document.createElement('div');
      item.className = 'dl-item' + (dl.completed ? ' completed' : '');
      item.innerHTML =
        '<div class="dl-check' + (dl.completed ? ' checked' : '') + '"></div>' +
        '<div class="dl-priority ' + dl.priority + '"></div>' +
        '<div class="dl-info">' +
          '<div class="dl-title">' + escapeHTML(dl.title) + '</div>' +
          '<div class="dl-meta"><span>' + escapeHTML(dl.course) + '</span><span>' + formatDate(dl.date) + '</span></div>' +
        '</div>' +
        '<div class="dl-days ' + daysClass + '">' + daysText + '</div>' +
        '<button class="dl-remove" title="Remove">&times;</button>';

      (function (id) {
        item.querySelector('.dl-check').addEventListener('click', function () {
          for (var d = 0; d < deadlines.length; d++) {
            if (deadlines[d].id === id) { deadlines[d].completed = !deadlines[d].completed; break; }
          }
          saveDeadlines();
          renderDeadlines();
        });
        item.querySelector('.dl-remove').addEventListener('click', function () {
          deadlines = deadlines.filter(function (x) { return x.id !== id; });
          saveDeadlines();
          renderDeadlines();
        });
      })(dl.id);

      list.appendChild(item);
    }

    document.getElementById('dueThisWeek').textContent = dueCount;
    document.getElementById('overdue').textContent = overdueCount;
  }

  document.getElementById('addDeadline').addEventListener('click', function () {
    var title = document.getElementById('dlTitle').value.trim();
    var date = document.getElementById('dlDate').value;
    if (!title) { document.getElementById('dlTitle').focus(); return; }
    if (!date) { document.getElementById('dlDate').focus(); return; }

    deadlines.push({
      id: dlIdCounter++,
      title: title,
      course: document.getElementById('dlCourse').value.trim() || 'General',
      date: date,
      priority: document.getElementById('dlPriority').value,
      completed: false
    });

    document.getElementById('dlTitle').value = '';
    document.getElementById('dlCourse').value = '';
    saveDeadlines();
    renderDeadlines();
  });

  // Set default date
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, '0');
  var mm = String(today.getMonth() + 1).padStart(2, '0');
  document.getElementById('dlDate').value = today.getFullYear() + '-' + mm + '-' + dd;

  loadDeadlines();

  // UTILITIES
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

})();
