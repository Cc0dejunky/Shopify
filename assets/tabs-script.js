document.querySelectorAll('.tab-header').forEach(tab => {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.tab-header').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

    this.classList.add('active');
    document.getElementById(this.dataset.tab).classList.add('active');
  });
});
