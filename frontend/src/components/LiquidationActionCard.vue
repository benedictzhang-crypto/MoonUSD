<script setup>
const props = defineProps({
  targetAddress: {
    type: String,
    default: '',
  },
  burnAmount: {
    type: [String, Number],
    default: '',
  },
  helperText: {
    type: String,
    default: '',
  },
  preview: {
    type: Object,
    default: null,
  },
  previewError: {
    type: String,
    default: '',
  },
  previewLoading: {
    type: Boolean,
    default: false,
  },
  pending: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  previewAction: {
    type: Function,
    required: true,
  },
  submitAction: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['update:targetAddress', 'update:burnAmount'])

async function handlePreview() {
  await props.previewAction()
}

async function handleSubmit() {
  const didSucceed = await props.submitAction()

  if (didSucceed) {
    emit('update:burnAmount', '')
  }
}
</script>

<template>
  <article class="action-card panel-card">
    <div class="action-head">
      <h3>Liquidate Unhealthy Vault</h3>
      <p>
        Burn your MoonUSD to seize discounted ETH from a vault that has fallen below the 150%
        collateral ratio threshold.
      </p>
    </div>

    <div class="action-body">
      <label class="input-label" for="liquidation-target">Target wallet</label>
      <input
        id="liquidation-target"
        :value="targetAddress"
        class="input-field"
        type="text"
        placeholder="0x..."
        :disabled="pending || disabled"
        @input="emit('update:targetAddress', $event.target.value)"
      />

      <label class="input-label" for="liquidation-burn">MoonUSD to burn</label>
      <input
        id="liquidation-burn"
        :value="burnAmount"
        class="input-field"
        type="number"
        min="0"
        step="any"
        placeholder="0.00"
        :disabled="pending || disabled"
        @input="emit('update:burnAmount', $event.target.value)"
      />

      <p class="helper-text">{{ helperText }}</p>
      <p v-if="previewError" class="error-text">{{ previewError }}</p>
    </div>

    <div v-if="preview" class="preview-box">
      <div>
        <span>Current ratio</span>
        <strong>{{ preview.currentRatio }}</strong>
      </div>
      <div>
        <span>Debt</span>
        <strong>{{ preview.debt }}</strong>
      </div>
      <div>
        <span>Collateral to seize</span>
        <strong>{{ preview.seizeAmount }}</strong>
      </div>
      <div>
        <span>Ratio after liquidation</span>
        <strong>{{ preview.resultingRatio }}</strong>
      </div>
    </div>

    <div class="button-row">
      <button
        class="button-secondary"
        type="button"
        :disabled="pending || disabled"
        @click="handlePreview"
      >
        {{ previewLoading ? 'Loading...' : 'Preview liquidation' }}
      </button>
      <button class="button" type="button" :disabled="pending || disabled" @click="handleSubmit">
        {{ pending ? 'Liquidating...' : 'Execute liquidation' }}
      </button>
    </div>
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

.preview-box {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.preview-box div {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(20, 20, 20, 0.06);
}

.preview-box span {
  display: block;
  margin-bottom: 6px;
  color: var(--text-soft);
  font-size: 0.86rem;
}

.error-text {
  margin: 0;
  color: var(--danger);
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

@media (max-width: 560px) {
  .preview-box {
    grid-template-columns: 1fr;
  }
}
</style>
