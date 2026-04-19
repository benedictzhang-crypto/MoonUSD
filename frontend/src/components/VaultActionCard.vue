<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  helperText: {
    type: String,
    default: '',
  },
  buttonLabel: {
    type: String,
    required: true,
  },
  inputLabel: {
    type: String,
    default: 'Amount',
  },
  modelValue: {
    type: [String, Number],
    default: '',
  },
  pending: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  submitAction: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

async function handleSubmit() {
  const didSucceed = await props.submitAction(props.modelValue)

  if (didSucceed) {
    emit('update:modelValue', '')
  }
}
</script>

<template>
  <article class="action-card panel-card">
    <div class="action-head">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>

    <div class="action-body">
      <label class="input-label" :for="title">{{ inputLabel }}</label>
      <input
        :id="title"
        :value="modelValue"
        class="input-field"
        type="number"
        min="0"
        step="any"
        placeholder="0.00"
        :disabled="pending || disabled"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <p class="helper-text">{{ helperText }}</p>
    </div>

    <button class="button" type="button" :disabled="pending || disabled" @click="handleSubmit">
      {{ pending ? `${buttonLabel}...` : buttonLabel }}
    </button>
  </article>
</template>

<style scoped>
.action-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px;
}

.action-head h3 {
  margin: 0 0 8px;
  font-size: 1.15rem;
}

.action-head p,
.helper-text {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.65;
}

.action-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-label {
  color: var(--text);
  font-weight: 600;
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
