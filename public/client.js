document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('comments');
    const div = document.querySelector('.fridgenotes');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const response = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: form.name.value,
                comment: form.comment.value
            }),
        });

        if (response.ok) {
            form.name.value = '';
            form.comment.value = '';
            fetchComments();
        }
    });

    function renderList(doc) {
        const main_div = document.createElement('div');
        const card_body = document.createElement('div');

        main_div.className = 'newnote';
        card_body.className = 'card-body';

        const fields = ['name', 'time', 'comment'];
        fields.forEach(field => {
            let content = doc[field];
            if (field === 'time') content = new Date(content).toLocaleDateString();

            const words = content.replace(/\s+/g, ' ').trim().split(" ");
            let html = "";

            words.forEach(word => {
                html += `<span class="rotate">${word}</span> `;
            });

            if (field === 'name') {
                card_body.insertAdjacentHTML('beforeend', html);
            } else {
                card_body.insertAdjacentHTML('beforeend', html + "<br style=\"clear:both\"><br>");
            }
        });

        const spans = card_body.querySelectorAll('.rotate');
        spans.forEach(span => {
            const direction = Math.random() < 0.5 ? -5 : 5;
            const rotation = direction * Math.random();
            span.style.transform = `rotate(${rotation.toFixed(1)}deg)`;
        });

        main_div.appendChild(card_body);
        div.prepend(main_div);
    }

    async function fetchComments() {
        const response = await fetch('/api/comments');
        const comments = await response.json();
        div.innerHTML = '';
        comments.forEach(renderList);
    }

    fetchComments();

    const nameField = document.querySelector('[name="name"]');
    nameField.addEventListener('keypress', function (event) {
        if (event.keyCode === 32) event.preventDefault();
    });
});

function validate(input) {
    if (/^\s/.test(input.value)) input.value = '';
}
