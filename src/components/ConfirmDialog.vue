<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title?: string
  message: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLDialogElement>()

watch(
  () => props.open,
  (open) => {
    if (!dialogRef.value) return
    open ? dialogRef.value.showModal() : dialogRef.value.close()
  },
)
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialogRef" class="confirm-dialog" @close="emit('cancel')">
      <h3 v-if="title">{{ title }}</h3>
      <p>{{ message }}</p>
      <div class="confirm-dialog__actions">
        <button class="secondary-button" type="button" @click="emit('cancel')">取消</button>
        <button class="primary-button danger" type="button" @click="emit('confirm')">删除</button>
      </div>
    </dialog>
  </Teleport>
</template>
