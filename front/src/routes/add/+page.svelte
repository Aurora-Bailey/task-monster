<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Add Task</title>
	<meta name="description" content="Add a task" />
</svelte:head>

<div class="text-column">
    <div class="paper">
        <form>
            <input class="full" type="text" placeholder="Name the task!" />
            <label>Alarm </label><input class="half" type="checkbox"/>
            <button>Add</button>
        </form>
    </div>
</div>

<style>
    .paper {
        position: relative;
        width: 500px;
        padding: 30px;
        border-radius: 3px;
        box-shadow: 10px 10px 5px 0px rgba(0,0,0,0.75);
        background-color: white;
        border: 1px solid rgba(0,0,0,0.2);
    }

    input {
        float: left;
        border-bottom: 2px solid var(--color-theme-2);
    }

    input.full {
        width: 100%;
    }

    input.half {
        width: 50%;
    }

    button {
        width: 50%;
        border-radius: 3px;
        background-color: var(--color-theme-2);
        margin: 20px 0px 0px;
        color: white;
    }
</style>
