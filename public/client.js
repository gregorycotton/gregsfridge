document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('comments');
    const div = document.querySelector('.fridgenotes');
    const status = document.getElementById('comments-status');
    const sentinel = document.getElementById('comments-sentinel');
    let nextCursor = null;
    let hasMore = true;
    let loading = false;
    let requestVersion = 0;

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
            resetComments();
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

            const words = content.replace(/\s+/g, ' ').trim().split(' ');
            words.forEach(word => {
                const span = document.createElement('span');
                span.className = 'rotate';
                span.textContent = word;
                card_body.append(span, document.createTextNode(' '));
            });

            if (field !== 'name') {
                const lineBreak = document.createElement('br');
                lineBreak.style.clear = 'both';
                card_body.append(lineBreak, document.createElement('br'));
            }
        });

        const spans = card_body.querySelectorAll('.rotate');
        spans.forEach(span => {
            const direction = Math.random() < 0.5 ? -5 : 5;
            const rotation = direction * Math.random();
            span.style.transform = `rotate(${rotation.toFixed(1)}deg)`;
        });

        main_div.appendChild(card_body);
        div.insertBefore(main_div, status);
    }

    async function fetchComments() {
        if (loading || !hasMore) return;
        const version = requestVersion;
        loading = true;
        status.textContent = 'Loading…';

        try {
            const params = new URLSearchParams();
            if (nextCursor) {
                params.set('beforeTime', nextCursor.time);
                params.set('beforeId', nextCursor.id);
            }
            const query = nextCursor ? `?${params}` : '';
            const response = await fetch(`/api/comments${query}`);
            if (!response.ok) throw new Error('Comments could not be loaded');
            const result = await response.json();
            if (version !== requestVersion) return;

            result.comments.forEach(renderList);
            nextCursor = result.nextCursor;
            hasMore = Boolean(nextCursor);
            status.textContent = '';
        } catch (error) {
            if (version === requestVersion) status.textContent = error.message;
        } finally {
            if (version === requestVersion) loading = false;
        }
    }

    function resetComments() {
        requestVersion += 1;
        nextCursor = null;
        hasMore = true;
        loading = false;
        div.querySelectorAll('.newnote').forEach(note => note.remove());
        fetchComments();
    }

    const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) fetchComments();
    });
    observer.observe(sentinel);
    resetComments();

    const nameField = document.querySelector('[name="name"]');
    nameField.addEventListener('keypress', function (event) {
        if (event.keyCode === 32) event.preventDefault();
    });
});

function validate(input) {
    if (/^\s/.test(input.value)) input.value = '';
}
